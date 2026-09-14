package com.learnup.gateway.handler;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnup.common.response.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.web.reactive.error.ErrorWebExceptionHandler;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * Global reactive error handler converting gateway-level exceptions into standardized ApiResponse JSON envelopes.
 */
@Component
@Order(-2)
public class GatewayErrorWebExceptionHandler implements ErrorWebExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GatewayErrorWebExceptionHandler.class);

    private final ObjectMapper objectMapper;

    public GatewayErrorWebExceptionHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public Mono<Void> handle(ServerWebExchange exchange, Throwable ex) {
        ServerHttpResponse response = exchange.getResponse();

        if (response.isCommitted()) {
            return Mono.error(ex);
        }

        HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR;
        String errorCode = "INTERNAL_ERROR";
        String message = "An internal gateway error occurred";

        if (ex instanceof ResponseStatusException rse) {
            status = HttpStatus.valueOf(rse.getStatusCode().value());
            if (status == HttpStatus.NOT_FOUND) {
                errorCode = "RESOURCE_NOT_FOUND";
                message = "The requested gateway route or resource was not found";
            } else if (status == HttpStatus.SERVICE_UNAVAILABLE) {
                errorCode = "SERVICE_UNAVAILABLE";
                message = "The requested service is currently unavailable or starting up";
            } else {
                errorCode = status.name();
                message = rse.getReason() != null ? rse.getReason() : status.getReasonPhrase();
            }
        }

        log.warn("Gateway error [status={}, code={}, message={}]: {}", status.value(), errorCode, message, ex.getMessage());

        response.setStatusCode(status);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);

        ApiResponse<Void> apiResponse = ApiResponse.error(errorCode, message);

        try {
            byte[] bytes = objectMapper.writeValueAsBytes(apiResponse);
            DataBuffer buffer = response.bufferFactory().wrap(bytes);
            return response.writeWith(Mono.just(buffer));
        } catch (JsonProcessingException e) {
            log.error("Failed to write JSON error response in GatewayErrorWebExceptionHandler", e);
            return response.setComplete();
        }
    }
}
