package com.example.demo.user;

import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface UserRepository extends MongoRepository<AppUser, String> {

	Optional<AppUser> findByEmail(String email);

	boolean existsByEmail(String email);
}
