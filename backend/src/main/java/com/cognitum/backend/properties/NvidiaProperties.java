package com.cognitum.backend.properties;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "nvidia.api")
public class NvidiaProperties {

    private String url;
    private String model;
    private String key;

}
