package com.learnup.notification.repository;

import com.learnup.notification.entity.DeliveryChannel;
import com.learnup.notification.entity.EnrollmentEventDelivery;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EnrollmentEventDeliveryRepository extends JpaRepository<EnrollmentEventDelivery, UUID> {

    Optional<EnrollmentEventDelivery> findByEventIdAndRecipientUserIdAndChannel(
            UUID eventId, UUID recipientUserId, DeliveryChannel channel);

    List<EnrollmentEventDelivery> findByEventId(UUID eventId);
}
