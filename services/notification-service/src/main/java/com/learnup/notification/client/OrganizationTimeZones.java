package com.learnup.notification.client;

import java.time.ZoneId;
import java.util.UUID;

/**
 * The time zone in which the dates of a message are written. Until tenant-service gives the zone of an Organization
 * the answer is the default of the settings; the rest of the code does not change when it does.
 */
public interface OrganizationTimeZones {

    ZoneId of(UUID organizationId);
}
