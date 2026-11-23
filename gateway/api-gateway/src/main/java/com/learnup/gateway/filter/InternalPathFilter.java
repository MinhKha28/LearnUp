package com.learnup.gateway.filter;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import java.util.regex.Pattern;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class InternalPathFilter implements WebFilter {

    // Include path parameters and backslashes that downstream servers may normalize.
    private static final Pattern INTERNAL_SEGMENT =
            Pattern.compile("(?:^|[/\\\\])internal(?=\\z|[/\\\\;])", Pattern.CASE_INSENSITIVE);

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        // URI#getPath decodes escaped separators and segment names, and excludes the query.
        String path = exchange.getRequest().getURI().getPath();
        if (INTERNAL_SEGMENT.matcher(path).find()) {
            return Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND));
        }
        return chain.filter(exchange);
    }
}
