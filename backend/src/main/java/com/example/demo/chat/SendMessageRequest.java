package com.example.demo.chat;

import com.example.demo.user.ResponseTone;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SendMessageRequest(
		@NotBlank @Size(max = 12000) String message,
		@NotNull ResponseTone tonePreference) {
}
