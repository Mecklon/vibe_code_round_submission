package com.example.demo.chat;

import java.util.List;
import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface ConversationRepository extends MongoRepository<Conversation, String> {

	List<Conversation> findByUserIdOrderByUpdatedAtDesc(String userId);

	Optional<Conversation> findByIdAndUserId(String id, String userId);
}
