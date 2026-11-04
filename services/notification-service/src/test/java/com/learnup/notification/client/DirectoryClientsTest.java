package com.learnup.notification.client;

import com.learnup.notification.enrollment.DependencyUnavailableException;
import com.learnup.notification.enrollment.PermanentDeliveryException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/** The two clients against the HTTP contract of tenant-service and course-service. */
class DirectoryClientsTest {

    private static final UUID ORGANIZATION = UUID.fromString("cda775cb-4d21-410d-979f-c94c8ec8b516");
    private static final UUID USER = UUID.fromString("188aa316-ed75-4fcb-a879-4dd3ad000a8a");
    private static final UUID COURSE = UUID.fromString("b2ab8537-2234-4407-93ff-aff997ff4da9");
    private static final String KEY = "a-private-test-key-of-32-bytes-long";

    private MockRestServiceServer tenantServer;
    private MockRestServiceServer courseServer;
    private TenantUserDirectoryClient tenant;
    private CourseServiceDirectoryClient course;

    @BeforeEach
    void setUp() {
        RestClient.Builder tenantBuilder = RestClient.builder();
        tenantServer = MockRestServiceServer.bindTo(tenantBuilder).build();
        tenant = new TenantUserDirectoryClient(
                tenantBuilder.baseUrl("http://tenant").defaultHeader("x-internal-key", KEY).build());

        RestClient.Builder courseBuilder = RestClient.builder();
        courseServer = MockRestServiceServer.bindTo(courseBuilder).build();
        course = new CourseServiceDirectoryClient(
                courseBuilder.baseUrl("http://course").defaultHeader("x-internal-key", KEY).build());
    }

    // ---- tenant-service

    @Test
    void aUserIsFoundWithTheKeyAndTheOrganizationOfTheEvent() {
        tenantServer.expect(requestTo("http://tenant/api/v1/internal/users/display-names"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("x-internal-key", KEY))
                .andExpect(header("X-Organization-ID", ORGANIZATION.toString()))
                .andExpect(content().json("{\"userIds\":[\"" + USER + "\"]}"))
                .andRespond(withSuccess("""
                        {"statusCode":200,"message":"Display names fetched","data":[
                          {"id":"%s","fullName":"Nguyễn Văn An","email":"an@example.com","role":"Learner","status":"Active","extra":1}
                        ]}""".formatted(USER), MediaType.APPLICATION_JSON));

        Recipient recipient = tenant.find(ORGANIZATION, USER).orElseThrow();

        assertThat(recipient.fullName()).isEqualTo("Nguyễn Văn An");
        assertThat(recipient.email()).isEqualTo("an@example.com");
        assertThat(recipient.canBeWrittenTo()).isTrue();
        tenantServer.verify();
    }

    @Test
    void aUserTheOrganizationDoesNotHaveIsEmpty() {
        tenantServer.expect(requestTo("http://tenant/api/v1/internal/users/display-names"))
                .andRespond(withSuccess("{\"statusCode\":200,\"data\":[]}", MediaType.APPLICATION_JSON));
        assertThat(tenant.find(ORGANIZATION, USER)).isEmpty();
    }

    @Test
    void aDeletedOrDeactivatedUserIsNotWrittenTo() {
        assertThat(new Recipient(USER, "A", "a@x.com", "Deleted").canBeWrittenTo()).isFalse();
        assertThat(new Recipient(USER, "A", "a@x.com", "Deactivated").canBeWrittenTo()).isFalse();
        assertThat(new Recipient(USER, "A", "a@x.com", "Pending").canBeWrittenTo()).isTrue();
        assertThat(new Recipient(USER, "A", " ", "Active").hasEmail()).isFalse();
    }

    @Test
    void aServerErrorOrATimeoutIsWorthRetrying() {
        tenantServer.expect(requestTo("http://tenant/api/v1/internal/users/display-names"))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));
        assertThatThrownBy(() -> tenant.find(ORGANIZATION, USER))
                .isInstanceOfSatisfying(DependencyUnavailableException.class,
                        e -> assertThat(e.code()).isEqualTo("TENANT_UNAVAILABLE"));

        tenantServer.reset();
        tenantServer.expect(requestTo("http://tenant/api/v1/internal/users/display-names"))
                .andRespond(request -> {
                    throw new IOException("connection reset");
                });
        assertThatThrownBy(() -> tenant.find(ORGANIZATION, USER))
                .isInstanceOf(DependencyUnavailableException.class);
    }

    @Test
    void aRefusalIsNotRetried() {
        for (HttpStatus status : new HttpStatus[]{HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN}) {
            tenantServer.reset();
            tenantServer.expect(requestTo("http://tenant/api/v1/internal/users/display-names"))
                    .andRespond(withStatus(status).contentType(MediaType.APPLICATION_JSON)
                            .body("{\"error\":{\"code\":\"ORGANIZATION_REQUIRED\",\"message\":\"SECRET TEXT\"}}"));
            assertThatThrownBy(() -> tenant.find(ORGANIZATION, USER))
                    .isInstanceOfSatisfying(PermanentDeliveryException.class, e -> {
                        assertThat(e.code()).isEqualTo("TENANT_REJECTED");
                        assertThat(e.getMessage()).doesNotContain("SECRET");
                    });
        }
    }

    @Test
    void aThrottleIsWorthRetrying() {
        tenantServer.expect(requestTo("http://tenant/api/v1/internal/users/display-names"))
                .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));
        assertThatThrownBy(() -> tenant.find(ORGANIZATION, USER)).isInstanceOf(DependencyUnavailableException.class);
    }

    @Test
    void anEmptyAnswerIsWorthRetrying() {
        tenantServer.expect(requestTo("http://tenant/api/v1/internal/users/display-names"))
                .andRespond(withSuccess("null", MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> tenant.find(ORGANIZATION, USER)).isInstanceOf(DependencyUnavailableException.class);
    }

    // ---- course-service

    @Test
    void aCourseNameIsFoundWithTheKeyAndTheOrganizationOfTheEvent() {
        courseServer.expect(requestTo("http://course/api/v1/internal/courses/batch"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("x-internal-key", KEY))
                .andExpect(header("X-Organization-ID", ORGANIZATION.toString()))
                .andExpect(content().json("{\"courseIds\":[\"" + COURSE + "\"]}"))
                .andRespond(withSuccess("""
                        {"statusCode":200,"message":"Courses fetched successfully","data":[
                          {"courseId":"%s","chainId":"%s","versionNumber":1,"name":"An toàn lao động","courseType":"Public","status":"Published","coverFileId":null}
                        ]}""".formatted(COURSE, COURSE), MediaType.APPLICATION_JSON));

        assertThat(course.nameOf(ORGANIZATION, COURSE)).contains("An toàn lao động");
        courseServer.verify();
    }

    @Test
    void aCourseThatIsLeftOutOfTheAnswerIsEmpty() {
        courseServer.expect(requestTo("http://course/api/v1/internal/courses/batch"))
                .andRespond(withSuccess("{\"statusCode\":200,\"data\":[]}", MediaType.APPLICATION_JSON));
        assertThat(course.nameOf(ORGANIZATION, COURSE)).isEqualTo(Optional.empty());
    }

    @Test
    void courseErrorsAreSortedLikeTheTenantOnes() {
        courseServer.expect(requestTo("http://course/api/v1/internal/courses/batch"))
                .andRespond(withStatus(HttpStatus.BAD_GATEWAY));
        assertThatThrownBy(() -> course.nameOf(ORGANIZATION, COURSE))
                .isInstanceOfSatisfying(DependencyUnavailableException.class,
                        e -> assertThat(e.code()).isEqualTo("COURSE_UNAVAILABLE"));

        courseServer.reset();
        courseServer.expect(requestTo("http://course/api/v1/internal/courses/batch"))
                .andRespond(withStatus(HttpStatus.UNAUTHORIZED));
        assertThatThrownBy(() -> course.nameOf(ORGANIZATION, COURSE))
                .isInstanceOfSatisfying(PermanentDeliveryException.class,
                        e -> assertThat(e.code()).isEqualTo("COURSE_REJECTED"));
    }
}
