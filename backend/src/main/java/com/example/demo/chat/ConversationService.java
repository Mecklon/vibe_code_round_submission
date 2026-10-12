package com.example.demo.chat;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Stream;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.example.demo.auth.AuthService;
import com.example.demo.user.AppUser;
import com.example.demo.user.ResponseTone;

@Service
public class ConversationService {

	private static final Logger logger = LoggerFactory.getLogger(ConversationService.class);

	private final ConversationRepository conversations;
	private final AuthService authService;
	private final ChatMemory chatMemory;
	private final ChatClient chatClient;
	private final boolean providerConfigured;

	public ConversationService(
			ConversationRepository conversations,
			AuthService authService,
			ChatMemory chatMemory,
			ChatClient.Builder chatClientBuilder,
			@Value("${spring.ai.openai.api-key:}") String apiKey) {
		this.conversations = conversations;
		this.authService = authService;
		this.chatMemory = chatMemory;
		this.chatClient = chatClientBuilder.build();
		this.providerConfigured = apiKey != null && !apiKey.isBlank();
	}

	public List<ConversationSummary> listForUser(String email) {
		String userId = authService.findByEmail(email).getId();
		return conversations.findByUserIdOrderByUpdatedAtDesc(userId).stream()
				.map(ConversationSummary::from)
				.toList();
	}

	public ConversationResponse create(String email) {
		AppUser user = authService.findByEmail(email);
		Instant now = Instant.now();
		return ConversationResponse.from(conversations.save(new Conversation(
				user.getId(), user.getTonePreference(), now)));
	}

	public ConversationResponse get(String email, String id) {
		return ConversationResponse.from(findOwnedConversation(email, id));
	}

	public SseEmitter sendMessage(String email, String id, SendMessageRequest request) {
		if (!providerConfigured) {
			throw new ChatProviderNotConfiguredException();
		}

		AppUser user = authService.updateTonePreference(email, request.tonePreference());
		Conversation conversation = findOwnedConversation(user, id);
		String message = request.message().trim();
		if (conversation.getMessages().isEmpty()) {
			conversation.setTitle(titleFrom(message));
		}
		conversation.setTonePreference(request.tonePreference());
		conversation.setUpdatedAt(Instant.now());
		conversation.addMessage(new ConversationMessage("user", message, Instant.now()));
		conversations.save(conversation);

		SseEmitter emitter = new SseEmitter(180_000L);
		CompletableFuture.runAsync(() -> streamReply(conversation, message, request.tonePreference(), emitter));
		return emitter;
	}

	private void streamReply(Conversation conversation, String userMessage, ResponseTone tone, SseEmitter emitter) {
		StringBuilder answer = new StringBuilder();
		try {
			List<Message> promptMessages = new ArrayList<>();
			promptMessages.add(new SystemMessage(systemInstruction(tone)));
			promptMessages.addAll(chatMemory.get(conversation.getId()));
			promptMessages.add(new UserMessage(userMessage));

			try (Stream<String> chunks = chatClient.prompt()
					.messages(promptMessages.toArray(Message[]::new))
					.stream()
					.content()
					.toStream()) {
				chunks.forEach(chunk -> {
					answer.append(chunk);
					try {
						emitter.send(SseEmitter.event().name("token").data(chunk, MediaType.TEXT_PLAIN));
					} catch (Exception exception) {
						throw new StreamDeliveryException(exception);
					}
				});
			}

			String response = answer.toString();
			chatMemory.add(conversation.getId(), List.of(new UserMessage(userMessage), new AssistantMessage(response)));
			conversation.addMessage(new ConversationMessage("assistant", response, Instant.now()));
			conversation.setUpdatedAt(Instant.now());
			conversations.save(conversation);
			emitter.send(SseEmitter.event().name("done").data("[DONE]"));
			emitter.complete();
		} catch (Exception exception) {
			logger.error("Chat generation failed for conversation {}", conversation.getId(), exception);
			try {
				emitter.send(SseEmitter.event().name("error")
						.data("Could not complete this reply. Check your AI provider settings and try again."));
			} catch (Exception deliveryException) {
				logger.debug("Could not send chat error event for conversation {}", conversation.getId(),
						deliveryException);
			}
			emitter.completeWithError(exception);
		}
	}

	private Conversation findOwnedConversation(String email, String id) {
		return findOwnedConversation(authService.findByEmail(email), id);
	}

	private Conversation findOwnedConversation(AppUser user, String id) {
		return conversations.findByIdAndUserId(id, user.getId())
				.orElseThrow(() -> new UsernameNotFoundException("Conversation not found"));
	}

	private String titleFrom(String message) {
		String title = message.replaceAll("\\s+", " ").trim();
		return title.length() <= 52 ? title : title.substring(0, 49) + "...";
	}

	private String systemInstruction(ResponseTone tone) {
		return switch (tone) {
			case PROFESSIONAL -> "Respond in a professional, clear, and respectful tone. Use structure when it improves readability.";
			case CASUAL -> "Respond in a warm, relaxed, conversational tone. Keep the language natural and approachable.";
			case CONCISE -> "Respond concisely and directly. Lead with the answer and include only useful details.";
		};
	}

	public static class ChatProviderNotConfiguredException extends RuntimeException {
		public ChatProviderNotConfiguredException() {
			super("The AI provider is not configured. Set OPENROUTER_API_KEY in backend/.env.");
		}
	}

	private static class StreamDeliveryException extends RuntimeException {
		private StreamDeliveryException(Exception cause) {
			super(cause);
		}
	}
}
