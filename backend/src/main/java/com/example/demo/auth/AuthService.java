package com.example.demo.auth;

import java.time.Instant;
import java.util.Locale;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.example.demo.user.AppUser;
import com.example.demo.user.ResponseTone;
import com.example.demo.user.UserRepository;

@Service
public class AuthService implements UserDetailsService {

	private final UserRepository users;
	private final PasswordEncoder passwordEncoder;

	public AuthService(UserRepository users, PasswordEncoder passwordEncoder) {
		this.users = users;
		this.passwordEncoder = passwordEncoder;
	}

	public AppUser register(AuthRequest request) {
		String email = normalizeEmail(request.email());
		if (users.existsByEmail(email)) {
			throw new EmailAlreadyRegisteredException();
		}

		String displayName = request.displayName() == null || request.displayName().isBlank()
				? email.substring(0, email.indexOf('@'))
				: request.displayName().trim();

		try {
			return users.save(new AppUser(email, displayName, passwordEncoder.encode(request.password()), Instant.now()));
		} catch (DuplicateKeyException exception) {
			throw new EmailAlreadyRegisteredException();
		}
	}

	@Override
	public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
		return users.findByEmail(normalizeEmail(email))
				.map(UserPrincipal::new)
				.orElseThrow(() -> new UsernameNotFoundException("Invalid email or password"));
	}

	public AppUser findByEmail(String email) {
		return users.findByEmail(normalizeEmail(email))
				.orElseThrow(() -> new UsernameNotFoundException("User not found"));
	}

	public AppUser updateTonePreference(String email, ResponseTone tonePreference) {
		AppUser user = findByEmail(email);
		user.setTonePreference(tonePreference);
		return users.save(user);
	}

	private String normalizeEmail(String email) {
		return email.trim().toLowerCase(Locale.ROOT);
	}

	public static class EmailAlreadyRegisteredException extends RuntimeException {
		public EmailAlreadyRegisteredException() {
			super("An account with this email already exists");
		}
	}
}
