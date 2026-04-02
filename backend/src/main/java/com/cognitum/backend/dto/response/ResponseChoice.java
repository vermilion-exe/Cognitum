package com.cognitum.backend.dto.response;

import com.cognitum.backend.dto.request.RequestMessage;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class ResponseChoice {

    private RequestMessage message;

}
