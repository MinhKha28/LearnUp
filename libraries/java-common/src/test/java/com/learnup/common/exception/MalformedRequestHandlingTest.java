package com.learnup.common.exception;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.common.response.ApiResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.mock.http.MockHttpInputMessage;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.HttpMediaTypeNotAcceptableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

/** A request the caller got wrong is a 4xx with the standard envelope, never a 500; and nothing the caller sent is echoed back. */
class MalformedRequestHandlingTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @RestController
    @RequestMapping("/probe")
    static class ProbeController {
        @GetMapping("/{id}")
        public String byId(@PathVariable UUID id) {
            return id.toString();
        }

        @GetMapping
        public String list(@RequestParam(required = false) UUID organizationId, @RequestParam Integer page) {
            return "ok";
        }

        @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
        public String create(@RequestBody Payload body) {
            return "ok";
        }

        @GetMapping(value = "/only/json", produces = MediaType.APPLICATION_JSON_VALUE)
        public String json() {
            return "\"x\"";
        }

        record Payload(String name) {
        }
    }

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(new ProbeController()).setControllerAdvice(new GlobalExceptionHandler()).build();
    }

    private MockHttpServletResponse call(MockHttpServletRequestBuilder request) throws Exception {
        return mvc.perform(request).andReturn().getResponse();
    }

    private static JsonNode error(MockHttpServletResponse response) throws Exception {
        JsonNode body = JSON.readTree(response.getContentAsString());
        assertThat(body.path("success").asBoolean(true)).as("success").isFalse();
        return body.path("error");
    }

    // ------------------------------------------------------------------ over HTTP (the real status the caller gets)

    @Test
    @DisplayName("a query parameter of the wrong type is 400 and the value is not echoed")
    void queryParameterOfTheWrongType() throws Exception {
        MockHttpServletResponse response = call(get("/probe").param("organizationId", "secret-not-a-uuid").param("page", "1"));
        assertThat(response.getStatus()).isEqualTo(400);
        assertThat(error(response).path("code").asText()).isEqualTo("BAD_REQUEST");
        assertThat(error(response).path("message").asText()).contains("organizationId");
        assertThat(response.getContentAsString()).doesNotContain("secret-not-a-uuid");

        assertThat(call(get("/probe").param("page", "abc")).getStatus()).isEqualTo(400);
        // a comma list is not one UUID either
        assertThat(call(get("/probe").param("organizationId", UUID.randomUUID() + "," + UUID.randomUUID()).param("page", "1")).getStatus())
                .isEqualTo(400);
        assertThat(call(get("/probe").param("organizationId", UUID.randomUUID().toString()).param("page", "1")).getStatus()).isEqualTo(200);
    }

    @Test
    @DisplayName("an id of the wrong type in the path is 400")
    void pathVariableOfTheWrongType() throws Exception {
        MockHttpServletResponse response = call(get("/probe/not-a-uuid"));
        assertThat(response.getStatus()).isEqualTo(400);
        assertThat(error(response).path("code").asText()).isEqualTo("BAD_REQUEST");
        assertThat(response.getContentAsString()).doesNotContain("not-a-uuid");
        assertThat(call(get("/probe/" + UUID.randomUUID())).getStatus()).isEqualTo(200);
    }

    @Test
    @DisplayName("a required parameter that is missing is 400")
    void missingRequiredParameter() throws Exception {
        MockHttpServletResponse response = call(get("/probe"));
        assertThat(response.getStatus()).isEqualTo(400);
        assertThat(error(response).path("code").asText()).isEqualTo("BAD_REQUEST");
        assertThat(error(response).path("message").asText()).contains("page");
    }

    @Test
    @DisplayName("a body that is not valid JSON is 400 and nothing of it is echoed")
    void malformedBody() throws Exception {
        MockHttpServletResponse response = call(post("/probe").contentType(MediaType.APPLICATION_JSON).content("{\"name\": secret-token"));
        assertThat(response.getStatus()).isEqualTo(400);
        assertThat(error(response).path("code").asText()).isEqualTo("BAD_REQUEST");
        assertThat(response.getContentAsString()).doesNotContain("secret-token");
        assertThat(call(post("/probe").contentType(MediaType.APPLICATION_JSON).content("")).getStatus()).isEqualTo(400);
        assertThat(call(post("/probe").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"ok\"}")).getStatus()).isEqualTo(200);
    }

    @Test
    @DisplayName("a content type the endpoint does not read is 415")
    void unsupportedMediaType() throws Exception {
        MockHttpServletResponse response = call(post("/probe").contentType(MediaType.TEXT_PLAIN).content("x"));
        assertThat(response.getStatus()).isEqualTo(415);
        assertThat(error(response).path("code").asText()).isEqualTo("BAD_REQUEST");
    }

    @Test
    @DisplayName("a response type the endpoint cannot produce is 406")
    void notAcceptable() throws Exception {
        assertThat(call(get("/probe/only/json").accept(MediaType.APPLICATION_XML)).getStatus()).isEqualTo(406);
    }

    @Test
    @DisplayName("a method the endpoint does not support is still 405, and a real server error is still 500")
    void existingMappingsStay() throws Exception {
        assertThat(call(put("/probe").contentType(MediaType.APPLICATION_JSON).content("{}")).getStatus()).isEqualTo(405);
        ResponseEntity<ApiResponse<Void>> generic = handler.handleGenericException(new RuntimeException("database down"));
        assertThat(generic.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // ------------------------------------------------------------------ the handlers themselves

    @Test
    @DisplayName("the handlers answer with fixed texts: the exception message is never returned")
    void fixedTexts() throws Exception {
        MethodParameter parameter = new MethodParameter(ProbeController.class.getDeclaredMethod("byId", UUID.class), 0);
        var mismatch = new MethodArgumentTypeMismatchException("PAYLOAD-SECRET", UUID.class, "id", parameter, new IllegalArgumentException("PAYLOAD-SECRET"));
        var unreadable = new HttpMessageNotReadableException("PAYLOAD-SECRET", new MockHttpInputMessage(new byte[0]));
        var unsupported = new HttpMediaTypeNotSupportedException("PAYLOAD-SECRET");
        var missing = new MissingServletRequestParameterException("page", "Integer");
        var notAcceptable = new HttpMediaTypeNotAcceptableException(List.of(MediaType.APPLICATION_JSON));

        List<ResponseEntity<ApiResponse<Void>>> answers = List.of(
                handler.handleTypeMismatch(mismatch), handler.handleNotReadable(unreadable), handler.handleUnsupportedMediaType(unsupported),
                handler.handleMissingParameter(missing), handler.handleNotAcceptable(notAcceptable));
        assertThat(answers).extracting(answer -> answer.getStatusCode().value()).containsExactly(400, 400, 415, 400, 406);
        for (ResponseEntity<ApiResponse<Void>> answer : answers) {
            assertThat(answer.getBody()).isNotNull();
            assertThat(answer.getBody().isSuccess()).isFalse();
            assertThat(answer.getBody().getError().getCode()).isEqualTo("BAD_REQUEST");
            assertThat(answer.getBody().getError().getMessage()).doesNotContain("PAYLOAD-SECRET");
        }
    }
}
