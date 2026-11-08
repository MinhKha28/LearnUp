package com.learnup.notification.client;

import com.learnup.notification.config.EnrollmentEventsProperties;
import org.springframework.stereotype.Component;

import java.time.ZoneId;
import java.util.UUID;

/** Every Organization gets the default zone of the settings (Asia/Ho_Chi_Minh) until tenant-service says otherwise. */
@Component
public class DefaultOrganizationTimeZones implements OrganizationTimeZones {

    private final ZoneId zone;

    public DefaultOrganizationTimeZones(EnrollmentEventsProperties properties) {
        this.zone = ZoneId.of(properties.getDefaultTimeZone());
    }

    @Override
    public ZoneId of(UUID organizationId) {
        return zone;
    }
}
