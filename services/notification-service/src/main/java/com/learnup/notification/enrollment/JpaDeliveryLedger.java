package com.learnup.notification.enrollment;

import com.learnup.notification.config.EnrollmentEventsProperties;
import com.learnup.notification.entity.DeliveryChannel;
import com.learnup.notification.entity.EnrollmentEventDelivery;
import com.learnup.notification.repository.EnrollmentEventDeliveryRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.UUID;

/**
 * The ledger in the database. The unique key of the table is what keeps two rows from being made for one delivery.
 * Every call is its own transaction unless the caller already has one, in which case it joins it: the in-app notice
 * and the mark SENT of its row are written together.
 */
@Component
public class JpaDeliveryLedger implements DeliveryLedger {

    private final EnrollmentEventDeliveryRepository repository;
    private final EnrollmentEventsProperties properties;
    private final TransactionTemplate transaction;

    public JpaDeliveryLedger(EnrollmentEventDeliveryRepository repository, EnrollmentEventsProperties properties,
                             PlatformTransactionManager transactionManager) {
        this.repository = repository;
        this.properties = properties;
        this.transaction = new TransactionTemplate(transactionManager);
    }

    @Override
    public EnrollmentEventDelivery open(EnrollmentEvent event, UUID recipientUserId, DeliveryChannel channel, Instant now) {
        return repository.findByEventIdAndRecipientUserIdAndChannel(event.eventId(), recipientUserId, channel)
                .orElseGet(() -> create(event, recipientUserId, channel, now));
    }

    private EnrollmentEventDelivery create(EnrollmentEvent event, UUID recipientUserId, DeliveryChannel channel, Instant now) {
        try {
            return repository.saveAndFlush(new EnrollmentEventDelivery(
                    event.eventId(), event.type().wireName(), event.organizationId(), event.enrollmentId(),
                    recipientUserId, channel, event.occurredAt(), now));
        } catch (DataIntegrityViolationException raced) {
            // Another consumer made the row between the look and the insert: use theirs.
            return repository.findByEventIdAndRecipientUserIdAndChannel(event.eventId(), recipientUserId, channel)
                    .orElseThrow(() -> raced);
        }
    }

    @Override
    public boolean claim(EnrollmentEventDelivery delivery, Instant now) {
        Boolean won = transaction.execute(status -> {
            // The row is locked until this transaction ends: a second handler waits here and then sees the state the
            // first one left, so only one of them finds it claimable.
            EnrollmentEventDelivery stored = repository.lockById(delivery.getId()).orElse(null);
            if (stored == null || !stored.claimableAt(now, properties.getClaimLease())) {
                return false;
            }
            stored.claimed(now);
            repository.saveAndFlush(stored);
            delivery.refreshFrom(stored);
            return true;
        });
        return Boolean.TRUE.equals(won);
    }

    @Override
    public void record(EnrollmentEventDelivery delivery) {
        repository.saveAndFlush(delivery);
    }
}
