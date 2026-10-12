package com.example.demo.auth;

import java.time.Instant;

import com.example.demo.user.AppUser;
import com.example.demo.user.ResponseTone;

public record UserResponse(String id, String email, String displayName, Instant createdAt, ResponseTone tonePreference) {

	public static UserResponse from(AppUser user) {
		return new UserResponse(user.getId(), user.getEmail(), user.getDisplayName(), user.getCreatedAt(),
				user.getTonePreference());
	}
}
