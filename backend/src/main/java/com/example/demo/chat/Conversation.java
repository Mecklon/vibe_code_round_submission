package com.example.demo.chat;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import com.example.demo.user.ResponseTone;

@Document(collection = "conversations")
@CompoundIndex(name = "user_updated_idx", def = "{'userId': 1, 'updatedAt': -1}")
public class Conversation {

	@Id
	private String id;
	private String userId;
	private String title;
	private ResponseTone tonePreference;
	private Instant createdAt;
	private Instant updatedAt;
	private List<ConversationMessage> messages = new ArrayList<>();

	public Conversation() {
	}

	public Conversation(String userId, ResponseTone tonePreference, Instant now) {
		this.userId = userId;
		this.title = "New conversation";
		this.tonePreference = tonePreference;
		this.createdAt = now;
		this.updatedAt = now;
	}

	public String getId() {
		return id;
	}

	public String getUserId() {
		return userId;
	}

	public String getTitle() {
		return title;
	}

	public ResponseTone getTonePreference() {
		return tonePreference;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

	public List<ConversationMessage> getMessages() {
		return messages;
	}

	public void setTitle(String title) {
		this.title = title;
	}

	public void setTonePreference(ResponseTone tonePreference) {
		this.tonePreference = tonePreference;
	}

	public void setUpdatedAt(Instant updatedAt) {
		this.updatedAt = updatedAt;
	}

	public void addMessage(ConversationMessage message) {
		if (messages == null) {
			messages = new ArrayList<>();
		}
		messages.add(message);
	}
}
