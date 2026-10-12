package com.example.demo.chat;

import java.util.List;

import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/conversations")
@Validated
public class ConversationController {

	private final ConversationService conversationService;

	public ConversationController(ConversationService conversationService) {
		this.conversationService = conversationService;
	}

	@GetMapping
	public List<ConversationSummary> list(Authentication authentication) {
		return conversationService.listForUser(authentication.getName());
	}

	@PostMapping
	public ConversationResponse create(Authentication authentication) {
		return conversationService.create(authentication.getName());
	}

	@GetMapping("/{id}")
	public ConversationResponse get(@PathVariable String id, Authentication authentication) {
		return conversationService.get(authentication.getName(), id);
	}

	@PostMapping(value = "/{id}/messages", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
	public SseEmitter sendMessage(
			@PathVariable String id,
			@Valid @RequestBody SendMessageRequest request,
			Authentication authentication) {
		return conversationService.sendMessage(authentication.getName(), id, request);
	}
}
