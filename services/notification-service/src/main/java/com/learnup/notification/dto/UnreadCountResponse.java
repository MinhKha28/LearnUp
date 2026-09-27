package com.learnup.notification.dto;

import java.util.UUID;

public class UnreadCountResponse {

    private UUID userId;
    private long unreadCount;

    public UnreadCountResponse() {
    }

    public UnreadCountResponse(UUID userId, long unreadCount) {
        this.userId = userId;
        this.unreadCount = unreadCount;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public long getUnreadCount() {
        return unreadCount;
    }

    public void setUnreadCount(long unreadCount) {
        this.unreadCount = unreadCount;
    }
}
