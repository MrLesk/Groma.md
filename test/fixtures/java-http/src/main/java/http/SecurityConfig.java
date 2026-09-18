package http;

@Configuration
public class SecurityConfig {
    public void matchers(HttpSecurity security) {
        security.authorizeHttpRequests(requests -> requests.requestMatchers("/api/**").permitAll());
    }
}
