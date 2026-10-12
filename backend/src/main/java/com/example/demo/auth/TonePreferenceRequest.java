package com.example.demo.auth;

import com.example.demo.user.ResponseTone;

import jakarta.validation.constraints.NotNull;

public record TonePreferenceRequest(@NotNull ResponseTone tonePreference) {
}
