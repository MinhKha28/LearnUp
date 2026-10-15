package com.learnup.identity.dto;

public class LogoutRequest {

    private String refreshToken;
    private Boolean logoutAll = false;

    public LogoutRequest() {
    }

    public LogoutRequest(String refreshToken) {
        this.refreshToken = refreshToken;
        this.logoutAll = false;
    }

    public LogoutRequest(String refreshToken, Boolean logoutAll) {
        this.refreshToken = refreshToken;
        this.logoutAll = logoutAll != null ? logoutAll : false;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public void setRefreshToken(String refreshToken) {
        this.refreshToken = refreshToken;
    }

    public Boolean getLogoutAll() {
        return logoutAll != null ? logoutAll : false;
    }

    public void setLogoutAll(Boolean logoutAll) {
        this.logoutAll = logoutAll;
    }
}
