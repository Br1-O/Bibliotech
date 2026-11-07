/**
 * Project     : Bibliotech  |  Frontend
 * Punto de entrada ES module: carga el tema, los controladores y el bootstrap
 * comun. Cada modulo declara sus propias dependencias.
 */

import "./theme.mjs";

import "./utils/dom.mjs";
import "./i18n/LanguageManager.mjs";
import "./utils/authHelper.mjs";
import "./utils/validator.mjs";
import "./components/icons/icons.mjs";
import "./components/passwordField/passwordField.mjs";
import "./components/button/button.mjs";
import "./components/loader/loader.mjs";
import "./components/toast/toast.mjs";
import "./components/modal/modal.mjs";
import "./components/materialViewer/materialViewer.mjs";
import "./components/tagInput/tagInput.mjs";
import "./components/cards/cards.mjs";
import "./components/materialEditor/materialEditor.mjs";
import "./components/contentTabs/contentTabs.mjs";
import "./components/profileSummary/profileSummary.mjs";
import "./components/passwordChange/passwordChange.mjs";
import "./components/navbar/navbar.mjs";
import "./components/pagination/pagination.mjs";
import "./services/apiService.mjs";

import "./frontControllers/authFrontController.mjs";
import "./frontControllers/adminDashboardFrontController.mjs";
import "./frontControllers/authorFrontController.mjs";
import "./frontControllers/catalogFrontController.mjs";
import "./frontControllers/favoritesFrontController.mjs";
import "./frontControllers/myContentFrontController.mjs";
import "./frontControllers/profileFrontController.mjs";
import "./frontControllers/studentDashboardFrontController.mjs";
import "./frontControllers/subjectFrontController.mjs";
import "./frontControllers/subjectsFrontController.mjs";
import "./frontControllers/teacherDashboardFrontController.mjs";

import "./app.mjs";
