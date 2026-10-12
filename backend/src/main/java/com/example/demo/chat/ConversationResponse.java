package com.example.demo.chat;

import java.time.Instant;
import java.util.List;

import com.example.demo.user.ResponseTone;

public record ConversationResponse(
		String id,
		String title,
		ResponseTone tonePreference,
		Instant createdAt,
		Instant updatedAt,
		List<ConversationMessage> messages) {

	public static ConversationResponse from(Conversation conversation) {
		return new ConversationResponse(conversation.getId(), conversation.getTitle(),
				conversation.getTonePreference(), conversation.getCreatedAt(), conversation.getUpdatedAt(),
				List.copyOf(conversation.getMessages()));
	}
}
