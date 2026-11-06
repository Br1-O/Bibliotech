/**
* Project     : Bibliotech  |  Capa: Aplicacion - Fachada
* MaterialService: conserva la API publica usada por rutas y controladores,
* delegando en servicios enfocados de subida, moderacion, gestion, catalogo,
* favoritos y acceso a archivos.
*/

const TtlCache = require('../../utils/ttlCache');
const fileHelper = require('../../utils/fileHelper');
const MaterialUploadService = require('./material/MaterialUploadService');
const MaterialModerationService = require('./material/MaterialModerationService');
const MaterialAssociationService = require('./material/MaterialAssociationService');
const MaterialManagementService = require('./material/MaterialManagementService');
const MaterialCatalogService = require('./material/MaterialCatalogService');
const MaterialFavoriteService = require('./material/MaterialFavoriteService');
const MaterialAccessService = require('./material/MaterialAccessService');

class MaterialService {
    constructor(materialRepository, subjectRepository, subscriptionRepository, auditLogService, languageManager, thematicTagService = null, fileStorage = fileHelper, notificationRepository = null, gamificationService = null, outboxService = null) {
        const referenceCache = new TtlCache({ ttlMs: 60000, maxEntries: 50 });
        const common = {
            materialRepository,
            subjectRepository,
            subscriptionRepository,
            auditLogService,
            languageManager,
            thematicTagService,
            fileStorage,
            notificationRepository,
            gamificationService,
            outboxService,
            referenceCache
        };

        this.uploadService = new MaterialUploadService(common);
        this.moderationService = new MaterialModerationService(common);
        this.associationService = new MaterialAssociationService(common);
        this.managementService = new MaterialManagementService(common);
        this.catalogService = new MaterialCatalogService(common);
        this.favoriteService = new MaterialFavoriteService(common);
        this.accessService = new MaterialAccessService(common);

        this.delegate(this.uploadService, [
            'uploadOrSuggestMaterial',
            'uploadBatch'
        ]);
        this.delegate(this.moderationService, [
            'approveMaterial',
            'getPendingForProfessor',
            'rejectMaterial',
            'getPendingMaterials'
        ]);
        this.delegate(this.associationService, [
            'associateMaterialToSubjects'
        ]);
        this.delegate(this.managementService, [
            'cancelPendingUpload',
            'update',
            'delete'
        ]);
        this.delegate(this.catalogService, [
            'getMyUploads',
            'getByAuthor',
            'getFilterOptions',
            'getGlobalContent',
            'getBySubject',
            'attachUserFlags',
            'attachFavoriteFlag'
        ]);
        this.delegate(this.favoriteService, [
            'toggleFavorite',
            'getFavorites'
        ]);
        this.delegate(this.accessService, [
            'getDownloadable'
        ]);
    }

    delegate(service, methods) {
        methods.forEach(method => {
            this[method] = service[method].bind(service);
        });
    }
}

module.exports = MaterialService;
