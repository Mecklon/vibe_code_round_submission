package com.example.demo.user;

import java.time.Instant;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "users")
public class AppUser {

	@Id
	private String id;

	@Indexed(unique = true)
	private String email;

	private String displayName;
	private String passwordHash;
	private Instant createdAt;
	private ResponseTone tonePreference = ResponseTone.PROFESSIONAL;

	public AppUser() {
	}

	public AppUser(String email, String displayName, String passwordHash, Instant createdAt) {
		this.email = email;
		this.displayName = displayName;
		this.passwordHash = passwordHash;
		this.createdAt = createdAt;
	}

	public String getId() {
		return id;
	}

	public String getEmail() {
		return email;
	}

	public String getDisplayName() {
		return displayName;
	}

	public String getPasswordHash() {
		return passwordHash;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public ResponseTone getTonePreference() {
		return tonePreference == null ? ResponseTone.PROFESSIONAL : tonePreference;
	}

	public void setTonePreference(ResponseTone tonePreference) {
		this.tonePreference = tonePreference;
	}
}
