package com.learnup.identity.integration;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/** Real loopback SMTP acceptance, not a mock JavaMailSender. Message data remains in memory only. */
final class DisposableSmtpReceiver implements AutoCloseable {
    private static final int MESSAGE_LIMIT = 262_144;
    private final ServerSocket listener;
    private final ExecutorService clients = Executors.newVirtualThreadPerTaskExecutor();
    private final Set<Socket> sockets = ConcurrentHashMap.newKeySet();
    private final ArrayBlockingQueue<AcceptedMessage> messages = new ArrayBlockingQueue<>(32);
    private final AtomicBoolean closed = new AtomicBoolean();
    private final Thread acceptor;

    DisposableSmtpReceiver() throws IOException {
        listener = new ServerSocket(0, 8, InetAddress.getByName("127.0.0.1"));
        acceptor = Thread.ofPlatform().daemon().name("identity-test-smtp-acceptor").start(this::accept);
    }

    int port() {
        return listener.getLocalPort();
    }

    AcceptedMessage awaitMessage(Duration timeout) throws InterruptedException {
        return messages.poll(timeout.toMillis(), TimeUnit.MILLISECONDS);
    }

    private void accept() {
        while (!closed.get()) {
            try {
                Socket socket = listener.accept();
                socket.setSoTimeout(10_000);
                sockets.add(socket);
                clients.submit(() -> receive(socket));
            } catch (IOException failure) {
                if (!closed.get()) {
                    closed.set(true);
                }
            }
        }
    }

    private void receive(Socket socket) {
        try (socket;
             var reader = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
             var writer = new BufferedWriter(new OutputStreamWriter(socket.getOutputStream(), StandardCharsets.US_ASCII))) {
            reply(writer, "220 identity-test.local ESMTP ready");
            List<String> recipients = new ArrayList<>();
            String command;
            while ((command = boundedLine(reader)) != null) {
                String verb = command.toUpperCase(Locale.ROOT);
                if (verb.startsWith("EHLO ")) {
                    reply(writer, "250-identity-test.local\r\n250-8BITMIME\r\n250 SIZE " + MESSAGE_LIMIT);
                } else if (verb.startsWith("HELO ")) {
                    reply(writer, "250 identity-test.local");
                } else if (verb.startsWith("MAIL FROM:")) {
                    recipients.clear();
                    reply(writer, "250 Sender accepted");
                } else if (verb.startsWith("RCPT TO:")) {
                    recipients.add(command.substring("RCPT TO:".length()).trim());
                    reply(writer, "250 Recipient accepted");
                } else if (verb.equals("DATA")) {
                    if (recipients.isEmpty()) {
                        reply(writer, "503 Recipient required");
                        continue;
                    }
                    reply(writer, "354 End data with <CRLF>.<CRLF>");
                    StringBuilder mime = new StringBuilder();
                    boolean tooLarge = false;
                    String line;
                    while ((line = boundedLine(reader)) != null && !line.equals(".")) {
                        if (line.startsWith("..")) {
                            line = line.substring(1);
                        }
                        if (!tooLarge && mime.length() + line.length() + 2 <= MESSAGE_LIMIT) {
                            mime.append(line).append("\r\n");
                        } else {
                            tooLarge = true;
                        }
                    }
                    if (line == null) {
                        return;
                    }
                    boolean accepted = !tooLarge && messages.offer(new AcceptedMessage(List.copyOf(recipients), mime.toString()));
                    reply(writer, accepted ? "250 Message accepted" : "452 Test receiver capacity exceeded");
                    recipients.clear();
                } else if (verb.equals("RSET")) {
                    recipients.clear();
                    reply(writer, "250 Reset");
                } else if (verb.equals("NOOP")) {
                    reply(writer, "250 OK");
                } else if (verb.equals("QUIT")) {
                    reply(writer, "221 Closing connection");
                    return;
                } else {
                    reply(writer, "502 Command not implemented");
                }
            }
        } catch (IOException ignored) {
            // Never render SMTP command/data content or exceptions containing it.
        } finally {
            sockets.remove(socket);
        }
    }

    private static String boundedLine(BufferedReader reader) throws IOException {
        StringBuilder line = new StringBuilder();
        int character;
        while ((character = reader.read()) != -1) {
            if (character == '\n') {
                if (!line.isEmpty() && line.charAt(line.length() - 1) == '\r') {
                    line.setLength(line.length() - 1);
                }
                return line.toString();
            }
            if (line.length() >= MESSAGE_LIMIT) {
                throw new IOException("SMTP test line exceeds bounded capacity");
            }
            line.append((char) character);
        }
        return line.isEmpty() ? null : line.toString();
    }

    private static void reply(BufferedWriter writer, String response) throws IOException {
        writer.write(response);
        writer.write("\r\n");
        writer.flush();
    }

    @Override
    public void close() throws IOException {
        closed.set(true);
        listener.close();
        for (Socket socket : sockets) {
            try {
                socket.close();
            } catch (SocketException ignored) {
                // Already closed by its owned SMTP session.
            }
        }
        clients.shutdownNow();
        messages.clear();
        try {
            acceptor.join(2_000);
        } catch (InterruptedException failure) {
            Thread.currentThread().interrupt();
        }
    }

    static final class AcceptedMessage {
        private final List<String> recipients;
        private final String mime;

        private AcceptedMessage(List<String> recipients, String mime) {
            this.recipients = recipients;
            this.mime = mime;
        }

        boolean addressedTo(String recipient) {
            return recipients.stream().anyMatch(value -> value.contains("<" + recipient + ">"));
        }

        String decodedBody() {
            return decodePart(mime);
        }

        @Override
        public String toString() {
            return "AcceptedMessage[content redacted]";
        }

        private static String decodePart(String part) {
            int separator = part.indexOf("\r\n\r\n");
            if (separator < 0) {
                return "";
            }
            String rawHeaders = part.substring(0, separator).replaceAll("\r\n[ \t]+", " ");
            Map<String, String> headers = rawHeaders.lines().filter(line -> line.contains(":"))
                    .collect(Collectors.toMap(line -> line.substring(0, line.indexOf(':')).toLowerCase(Locale.ROOT),
                            line -> line.substring(line.indexOf(':') + 1).trim(), (first, ignored) -> first));
            String body = part.substring(separator + 4);
            String type = headers.getOrDefault("content-type", "text/plain");
            if (type.toLowerCase(Locale.ROOT).startsWith("multipart/")) {
                Matcher boundary = Pattern.compile("boundary=(?:\"([^\"]+)\"|([^;\\s]+))", Pattern.CASE_INSENSITIVE).matcher(type);
                if (!boundary.find()) {
                    return "";
                }
                String marker = boundary.group(1) == null ? boundary.group(2) : boundary.group(1);
                return Pattern.compile("(?m)^--" + Pattern.quote(marker) + "(?:--)?\\r?$").splitAsStream(body)
                        .map(value -> value.startsWith("\r\n") ? value.substring(2) : value)
                        .map(AcceptedMessage::decodePart).collect(Collectors.joining("\n"));
            }
            String encoding = headers.getOrDefault("content-transfer-encoding", "7bit").toLowerCase(Locale.ROOT);
            if (encoding.equals("base64")) {
                return new String(Base64.getMimeDecoder().decode(body), StandardCharsets.UTF_8);
            }
            if (encoding.equals("quoted-printable")) {
                String unfolded = body.replace("=\r\n", "").replace("=\n", "");
                var decoded = new ByteArrayOutputStream();
                for (int index = 0; index < unfolded.length(); index++) {
                    char character = unfolded.charAt(index);
                    if (character == '=' && index + 2 < unfolded.length()) {
                        int high = Character.digit(unfolded.charAt(index + 1), 16);
                        int low = Character.digit(unfolded.charAt(index + 2), 16);
                        if (high >= 0 && low >= 0) {
                            decoded.write(high * 16 + low);
                            index += 2;
                            continue;
                        }
                    }
                    decoded.writeBytes(String.valueOf(character).getBytes(StandardCharsets.UTF_8));
                }
                return decoded.toString(StandardCharsets.UTF_8);
            }
            return body;
        }
    }
}
