package com.learnup.notification.repository;

import com.learnup.notification.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    Page<Notification> findByRecipientUserIdOrderByCreatedAtDesc(UUID recipientUserId, Pageable pageable);

    Page<Notification> findByRecipientUserIdAndIsReadOrderByCreatedAtDesc(UUID recipientUserId, boolean isRead, Pageable pageable);

    long countByRecipientUserIdAndIsReadFalse(UUID recipientUserId);

    Optional<Notification> findByIdAndRecipientUserId(UUID id, UUID recipientUserId);

    // UC49: a user sees what is addressed to them in their own Organization, plus the notices of the platform (no Organization).
    @Query("select n from Notification n where n.recipientUserId = :userId and (n.organizationId is null or n.organizationId = :organizationId)")
    Page<Notification> findVisible(@Param("userId") UUID userId, @Param("organizationId") UUID organizationId, Pageable pageable);

    @Query("select n from Notification n where n.recipientUserId = :userId and n.isRead = false and (n.organizationId is null or n.organizationId = :organizationId)")
    Page<Notification> findVisibleUnread(@Param("userId") UUID userId, @Param("organizationId") UUID organizationId, Pageable pageable);

    @Query("select count(n) from Notification n where n.recipientUserId = :userId and n.isRead = false and (n.organizationId is null or n.organizationId = :organizationId)")
    long countVisibleUnread(@Param("userId") UUID userId, @Param("organizationId") UUID organizationId);

    @Query("select n from Notification n where n.id = :id and n.recipientUserId = :userId and (n.organizationId is null or n.organizationId = :organizationId)")
    Optional<Notification> findVisibleById(@Param("id") UUID id, @Param("userId") UUID userId, @Param("organizationId") UUID organizationId);
}
