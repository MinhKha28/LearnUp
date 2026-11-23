package com.learnup.notification.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.core.io.ClassPathResource;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

class TopicManifestConsistencyTest {
    @Test void consumerDefaultsAndDltShapesMatchManifest() throws Exception {
        Map<String, String[]> topics = Files.readAllLines(Path.of("../../infrastructure/kafka/topics.tsv")).stream()
                .filter(line -> !line.isBlank() && !line.startsWith("#"))
                .map(line -> line.split("\t")).collect(Collectors.toMap(row -> row[0], row -> row));
        assertThat(topics).hasSize(9);
        var enrollment = new EnrollmentEventsProperties();
        var finalized = new SubmissionFinalizedEventsProperties();
        assertThat(enrollment.getTopic()).isEqualTo(topics.get("enrollment-events")[1]);
        assertThat(enrollment.getPeerReviewTopic()).isEqualTo(topics.get("peer-review-assigned")[1]);
        assertThat(finalized.getTopic()).isEqualTo(topics.get("submission-finalized")[1]);
        assertThat(enrollment.getDeadLetterTopic()).isEqualTo(topics.get("enrollment-dlt")[1]);
        assertThat(enrollment.getPeerReviewDeadLetterTopic()).isEqualTo(topics.get("peer-review-dlt")[1]);
        assertThat(finalized.getDlt()).isEqualTo(topics.get("submission-finalized-dlt")[1]);
        assertThat(enrollment.getDeadLetterPartitions()).isEqualTo(Integer.parseInt(topics.get("enrollment-dlt")[2]));
        assertThat(enrollment.getDeadLetterReplicas()).isEqualTo(Short.parseShort(topics.get("enrollment-dlt")[3]));
        assertThat(finalized.getDltPartitions()).isEqualTo(Integer.parseInt(topics.get("submission-finalized-dlt")[2]));
        assertThat(finalized.getDltReplicas()).isEqualTo(Short.parseShort(topics.get("submission-finalized-dlt")[3]));
        var yaml = new YamlPropertiesFactoryBean();
        yaml.setResources(new ClassPathResource("application.yml"));
        var defaults = yaml.getObject();
        assertThat(defaults.getProperty("learnup.course-events.topic"))
                .isEqualTo("${COURSE_EVENTS_TOPIC:" + topics.get("course-events")[1] + "}");
        assertThat(defaults.getProperty("learnup.course-events.dlt"))
                .isEqualTo("${COURSE_EVENTS_DLT:" + topics.get("course-dlt")[1] + "}");
    }
}
