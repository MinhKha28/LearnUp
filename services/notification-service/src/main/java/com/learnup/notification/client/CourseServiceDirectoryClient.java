package com.learnup.notification.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.learnup.common.context.HeaderConstants;
import com.learnup.notification.enrollment.DependencyUnavailableException;
import com.learnup.notification.enrollment.PermanentDeliveryException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Asks course-service what a Course version is called: {@code POST /api/v1/internal/courses/batch} with the internal
 * key and the Organization of the event. An unknown or foreign Course is left out of the answer, not an error.
 */
@Component
public class CourseServiceDirectoryClient implements CourseDirectory {

    private static final ParameterizedTypeReference<Envelope> ENVELOPE = new ParameterizedTypeReference<>() {
    };

    private final RestClient restClient;

    public CourseServiceDirectoryClient(@Qualifier("courseRestClient") RestClient restClient) {
        this.restClient = restClient;
    }

    @Override
    public Optional<String> nameOf(UUID organizationId, UUID courseId) {
        Envelope envelope;
        try {
            envelope = restClient.post()
                    .uri("/api/v1/internal/courses/batch")
                    .header(HeaderConstants.X_ORGANIZATION_ID, organizationId.toString())
                    .body(Map.of("courseIds", List.of(courseId.toString())))
                    .retrieve()
                    .body(ENVELOPE);
        } catch (RestClientResponseException e) {
            throw failure(e.getStatusCode());
        } catch (RestClientException e) {
            throw new DependencyUnavailableException("COURSE_UNAVAILABLE");
        }
        if (envelope == null || envelope.data() == null) {
            throw new DependencyUnavailableException("COURSE_UNAVAILABLE");
        }
        return envelope.data().stream()
                .filter(course -> courseId.equals(course.courseId()))
                .map(Course::name)
                .filter(name -> name != null && !name.isBlank())
                .findFirst();
    }

    static RuntimeException failure(HttpStatusCode status) {
        if (status.is5xxServerError() || status.value() == 429 || status.value() == 408) {
            return new DependencyUnavailableException("COURSE_UNAVAILABLE");
        }
        return new PermanentDeliveryException("COURSE_REJECTED");
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Envelope(List<Course> data) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Course(UUID courseId, String name) {
    }
}
