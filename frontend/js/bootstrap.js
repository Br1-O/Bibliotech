/**
 * Project     : Bibliotech  |  Frontend
 * Punto de entrada ES module: carga el tema, los controladores y el bootstrap
 * comun. Cada modulo declara sus propias dependencias.
 */

import "./theme.js";

import "./utils/dom.js";
import "./i18n/LanguageManager.js";
import "./utils/authHelper.js";
import "./utils/validator.js";
import "./components/icons/icons.js";
import "./components/passwordField/passwordField.js";
import "./components/button/button.js";
import "./components/loader/loader.js";
import "./components/toast/toast.js";
import "./components/modal/modal.js";
import "./components/materialViewer/materialViewer.js";
import "./components/tagInput/tagInput.js";
import "./components/cards/cards.js";
import "./components/materialEditor/materialEditor.js";
import "./components/contentTabs/contentTabs.js";
import "./components/profileSummary/profileSummary.js";
import "./components/passwordChange/passwordChange.js";
import "./components/navbar/navbar.js";
import "./components/pagination/pagination.js";
import "./services/apiService.js";

import "./frontControllers/authFrontController.js";
import "./frontControllers/adminDashboardFrontController.js";
import "./frontControllers/authorFrontController.js";
import "./frontControllers/catalogFrontController.js";
import "./frontControllers/favoritesFrontController.js";
import "./frontControllers/myContentFrontController.js";
import "./frontControllers/profileFrontController.js";
import "./frontControllers/studentDashboardFrontController.js";
import "./frontControllers/subjectFrontController.js";
import "./frontControllers/subjectsFrontController.js";
import "./frontControllers/teacherDashboardFrontController.js";

import "./app.js";
