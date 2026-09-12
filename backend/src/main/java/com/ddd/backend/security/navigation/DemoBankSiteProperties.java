package com.ddd.backend.security.navigation;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.Set;

@Component
@ConfigurationProperties(prefix = "ddd.demo-bank")
public class DemoBankSiteProperties {

    private boolean enabled = false;

    private String baseUrl =
            "http://127.0.0.1:5190";

    private Set<String> allowedHosts =
            Set.of(
                    "127.0.0.1",
                    "localhost"
            );

    private boolean genericEnabled = false;
    private String genericSiteId = "browser-site";
    private String genericBaseUrl = "";
    private Set<String> genericAllowedHosts = Set.of();

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(
            boolean enabled
    ) {
        this.enabled = enabled;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(
            String baseUrl
    ) {
        this.baseUrl = baseUrl;
    }

    public Set<String> getAllowedHosts() {
        return allowedHosts;
    }

    public void setAllowedHosts(
            Set<String> allowedHosts
    ) {
        this.allowedHosts = allowedHosts;
    }

    public boolean isGenericEnabled() { return genericEnabled; }
    public void setGenericEnabled(boolean genericEnabled) { this.genericEnabled = genericEnabled; }
    public String getGenericSiteId() { return genericSiteId; }
    public void setGenericSiteId(String genericSiteId) { this.genericSiteId = genericSiteId; }
    public String getGenericBaseUrl() { return genericBaseUrl; }
    public void setGenericBaseUrl(String genericBaseUrl) { this.genericBaseUrl = genericBaseUrl; }
    public Set<String> getGenericAllowedHosts() { return genericAllowedHosts; }
    public void setGenericAllowedHosts(Set<String> genericAllowedHosts) {
        this.genericAllowedHosts = genericAllowedHosts == null ? Set.of() : Set.copyOf(genericAllowedHosts);
    }
}
