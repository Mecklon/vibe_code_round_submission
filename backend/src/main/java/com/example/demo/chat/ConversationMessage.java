package com.example.demo.chat;

import java.time.Instant;

public record ConversationMessage(String role, String content, Instant createdAt) {
}
