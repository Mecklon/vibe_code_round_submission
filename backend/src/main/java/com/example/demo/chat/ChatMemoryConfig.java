package com.example.demo.chat;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.ChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;

@Configuration
public class ChatMemoryConfig {

	@Bean
	ChatMemory chatMemory(ChatMemoryRepository repository) {
		return MessageWindowChatMemory.builder()
				.chatMemoryRepository(repository)
				.maxMessages(40)
				.build();
	}
}
