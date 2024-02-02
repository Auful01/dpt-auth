import { BehaviorSubject } from 'rxjs';

import config from 'config';
import { fetchWrapper, history } from '@/_helpers';
import { setRawCookie } from 'react-cookies';
import Cookies from 'js-cookie';

const userSubject = new BehaviorSubject(null);
const baseUrl = `${config.apiUrl}`;

export const accountService = {
    login,
    logout,
    refreshToken,
    register,
    verifyEmail,
    forgotPassword,
    validateResetToken,
    resetPassword,
    getAll,
    getById,
    create,
    update,
    delete: _delete,
    user: userSubject.asObservable(),
    get userValue() { return userSubject.value }
};

function login(email, password) {
    return fetchWrapper.post(`${baseUrl}/auth/authenticate`, { email, password })
        .then(user => {
            console.log('User:', user);

            // cookies.set('sidita', user.token, { path: '/', domain: '

            // setRawCookie('sidita', user.token, { path: '/', domain: '103.175.220.146', expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365), maxAge: 0, httponly: true, secure: true, sameSite: 'strict' });
            const domain = window.location.hostname;

            Cookies.set('sidita', user.token, {
                path: '/',
                domain: domain,
                expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
                maxAge: 0,
                secure: true,  // Set to true if served over HTTPS
                sameSite: 'strict'  // Adjust as needed
            });
            // publish user to subscribers and start timer to refresh token
            userSubject.next(user);
            startRefreshTokenTimer();
            return user;
        })
        .catch(error => {
            console.log('Error:', error);
            console.error('Error during login:', error);
            throw error; // rethrow the error for further handling, if necessary
        });
}

function logout() {
    // revoke token, stop refresh timer, publish null to user subscribers and redirect to login page
    fetchWrapper.get(`${baseUrl}/auth/account/logout`, {});
    stopRefreshTokenTimer();
    userSubject.next(null);

    Cookies.remove('sidita');
    history.push('/account/login');
}

function refreshToken() {
    return fetchWrapper.post(`${baseUrl}/auth/account/refresh`, {})
        .then(user => {
            // publish user to subscribers and start timer to refresh token
            userSubject.next(user);
            startRefreshTokenTimer();
            return user;
        });
}

function register(params) {
    return fetchWrapper.post(`${baseUrl}/register`, params);
}

function verifyEmail(token) {
    return fetchWrapper.post(`${baseUrl}/verify-email`, { token });
}

function forgotPassword(email) {
    return fetchWrapper.post(`${baseUrl}/forgot-password`, { email });
}

function validateResetToken(token) {
    return fetchWrapper.post(`${baseUrl}/validate-reset-token`, { token });
}

function resetPassword({ token, password, confirmPassword }) {
    return fetchWrapper.post(`${baseUrl}/reset-password`, { token, password, confirmPassword });
}

function getAll() {
    return fetchWrapper.get(baseUrl);
}

function getById(id) {
    return fetchWrapper.get(`${baseUrl}/${id}`);
}

function create(params) {
    return fetchWrapper.post(baseUrl, params);
}

function update(id, params) {
    return fetchWrapper.put(`${baseUrl}/${id}`, params)
        .then(user => {
            // update stored user if the logged in user updated their own record
            if (user.id === userSubject.value.id) {
                // publish updated user to subscribers
                user = { ...userSubject.value, ...user };
                userSubject.next(user);
            }
            return user;
        });
}

// prefixed with underscore because 'delete' is a reserved word in javascript
function _delete(id) {
    return fetchWrapper.delete(`${baseUrl}/${id}`)
        .then(x => {
            // auto logout if the logged in user deleted their own record
            if (id === userSubject.value.id) {
                logout();
            }
            return x;
        });
}

// helper functions

let refreshTokenTimeout;

function startRefreshTokenTimer() {
    // parse json object from base64 encoded jwt token
    const jwtToken = JSON.parse(atob(userSubject.value.token.split('.')[1]));

    // set a timeout to refresh the token a minute before it expires
    const expires = new Date(jwtToken.exp * 1000);
    const timeout = expires.getTime() - Date.now() - (60 * 1000);
    refreshTokenTimeout = setTimeout(refreshToken, timeout);
}

function stopRefreshTokenTimer() {
    clearTimeout(refreshTokenTimeout);
}
