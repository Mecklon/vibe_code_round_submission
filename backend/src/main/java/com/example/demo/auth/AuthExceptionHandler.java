package com.example.demo.auth;

import java.util.Map;

import com.example.demo.chat.ConversationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class AuthExceptionHandler {

	@ExceptionHandler(AuthService.EmailAlreadyRegisteredException.class)
	public ResponseEntity<Map<String, String>> emailAlreadyRegistered(
			AuthService.EmailAlreadyRegisteredException exception) {
		return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", exception.getMessage()));
	}

	@ExceptionHandler({ BadCredentialsException.class })
	public ResponseEntity<Map<String, String>> invalidCredentials() {
		return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
				.body(Map.of("message", "Invalid email or password"));
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<Map<String, String>> invalidRequest(MethodArgumentNotValidException exception) {
		String message = exception.getBindingResult().getFieldErrors().stream()
				.findFirst()
				.map(error -> error.getDefaultMessage() == null ? "Invalid request" : error.getDefaultMessage())
				.orElse("Invalid request");
		return ResponseEntity.badRequest().body(Map.of("message", message));
	}

	@ExceptionHandler(ConversationService.ChatProviderNotConfiguredException.class)
	public ResponseEntity<Map<String, String>> chatProviderNotConfigured(
			ConversationService.ChatProviderNotConfiguredException exception) {
		return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
				.body(Map.of("message", exception.getMessage()));
	}
}
