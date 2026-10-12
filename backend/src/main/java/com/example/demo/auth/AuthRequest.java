package com.example.demo.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AuthRequest(
		@Email @NotBlank @Size(max = 254) String email,
		@NotBlank @Size(min = 8, max = 72) String password,
		@Size(max = 80) String displayName) {
}
