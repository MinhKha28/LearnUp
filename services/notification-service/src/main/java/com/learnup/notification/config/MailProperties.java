package com.learnup.notification.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "learnup.mail")
public class MailProperties {

    /**
     * Flag to enable physical email dispatch via JavaMailSender / SMTP.
     * When false (default for dev/testing), email deliveries are logged and recorded in email_logs without invoking SMTP.
     */
    private boolean enabled = false;

    /**
     * Default 'From' email address header.
     */
    private String from = "noreply@learnup.com";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getFrom() {
        return from;
    }

    public void setFrom(String from) {
        this.from = from;
    }
}
