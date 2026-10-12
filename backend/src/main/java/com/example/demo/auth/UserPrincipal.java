package com.example.demo.auth;

import java.util.Collection;
import java.util.List;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import com.example.demo.user.AppUser;

public class UserPrincipal implements UserDetails {

	private final AppUser user;

	public UserPrincipal(AppUser user) {
		this.user = user;
	}

	public AppUser getUser() {
		return user;
	}

	@Override
	public Collection<? extends GrantedAuthority> getAuthorities() {
		return List.of();
	}

	@Override
	public String getPassword() {
		return user.getPasswordHash();
	}

	@Override
	public String getUsername() {
		return user.getEmail();
	}
}
