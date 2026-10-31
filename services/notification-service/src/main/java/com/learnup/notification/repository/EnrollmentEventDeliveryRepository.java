package com.learnup.notification.repository;

import com.learnup.notification.entity.DeliveryChannel;
import com.learnup.notification.entity.EnrollmentEventDelivery;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EnrollmentEventDeliveryRepository extends JpaRepository<EnrollmentEventDelivery, UUID> {

    Optional<EnrollmentEventDelivery> findByEventIdAndRecipientUserIdAndChannel(
            UUID eventId, UUID recipientUserId, DeliveryChannel channel);

    List<EnrollmentEventDelivery> findByEventId(UUID eventId);

    /**
     * The row, locked until the end of the transaction ({@code SELECT ... FOR UPDATE}, the same SQL on PostgreSQL and H2).
     * A second caller waits here and then reads the row as the first one left it, which is what makes a claim safe
     * between handlers (a plain conditional UPDATE is not re-checked after the wait by every database).
     */
    @Query(value = "SELECT * FROM enrollment_event_deliveries WHERE id = :id FOR UPDATE", nativeQuery = true)
    Optional<EnrollmentEventDelivery> lockById(@Param("id") UUID id);
}
