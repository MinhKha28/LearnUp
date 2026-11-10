package com.learnup.identity.mapper;

import com.learnup.identity.domain.User;
import com.learnup.identity.dto.UserResponse;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;
import org.mapstruct.ReportingPolicy;

/** Explicit public-field allowlist: credentials and future source properties are not copied implicitly. */
@Mapper(componentModel = MappingConstants.ComponentModel.SPRING, unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface UserMapper {
    @BeanMapping(ignoreByDefault = true)
    @Mapping(target = "id", source = "id")
    @Mapping(target = "username", source = "username")
    @Mapping(target = "email", source = "email")
    @Mapping(target = "fullName", source = "fullName")
    @Mapping(target = "role", source = "role")
    @Mapping(target = "organizationId", source = "organizationId")
    @Mapping(target = "enabled", source = "enabled")
    @Mapping(target = "createdAt", source = "createdAt")
    UserResponse toResponse(User user);
}
