package com.example.demo.auth;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.demo.user.AppUser;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
@Validated
public class AuthController {

	private final AuthService authService;
	private final AuthenticationManager authenticationManager;
	private final SecurityContextRepository securityContextRepository;

	public AuthController(
			AuthService authService,
			AuthenticationManager authenticationManager,
			SecurityContextRepository securityContextRepository) {
		this.authService = authService;
		this.authenticationManager = authenticationManager;
		this.securityContextRepository = securityContextRepository;
	}

	@PostMapping("/register")
	public ResponseEntity<UserResponse> register(@Valid @RequestBody AuthRequest request) {
		AppUser user = authService.register(request);
		return ResponseEntity.status(HttpStatus.CREATED).body(UserResponse.from(user));
	}

	@GetMapping("/csrf")
	public ResponseEntity<Void> csrfToken(CsrfToken csrfToken) {
		csrfToken.getToken();
		return ResponseEntity.noContent().build();
	}

	@PostMapping("/login")
	public UserResponse login(
			@Valid @RequestBody AuthRequest request,
			HttpServletRequest httpRequest,
			HttpServletResponse httpResponse) {
		Authentication authentication = authenticationManager.authenticate(
				UsernamePasswordAuthenticationToken.unauthenticated(request.email(), request.password()));
		SecurityContext context = SecurityContextHolder.createEmptyContext();
		context.setAuthentication(authentication);
		SecurityContextHolder.setContext(context);
		securityContextRepository.saveContext(context, httpRequest, httpResponse);

		UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
		return UserResponse.from(principal.getUser());
	}

	@GetMapping("/me")
	public UserResponse currentUser(Authentication authentication) {
		UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
		return UserResponse.from(principal.getUser());
	}

	@PostMapping("/preferences/tone")
	public UserResponse updateTonePreference(
			@Valid @RequestBody TonePreferenceRequest request,
			Authentication authentication) {
		return UserResponse.from(authService.updateTonePreference(authentication.getName(), request.tonePreference()));
	}
}
