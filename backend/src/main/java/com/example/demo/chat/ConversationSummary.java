package com.example.demo.chat;

import java.time.Instant;

import com.example.demo.user.ResponseTone;

public record ConversationSummary(
		String id,
		String title,
		ResponseTone tonePreference,
		Instant createdAt,
		Instant updatedAt) {

	public static ConversationSummary from(Conversation conversation) {
		return new ConversationSummary(conversation.getId(), conversation.getTitle(),
				conversation.getTonePreference(), conversation.getCreatedAt(), conversation.getUpdatedAt());
	}
}
