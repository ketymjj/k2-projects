namespace K2Projects.Application.Common;

/// <summary>Códigos estáveis de erro retornados pela API. Não renomear: o frontend usa estes valores como chave de tradução.</summary>
public static class ErrorCodes
{
    // Genéricos
    public const string NotFound = "NOT_FOUND";
    public const string Forbidden = "FORBIDDEN";
    public const string Unauthorized = "UNAUTHORIZED";
    public const string Conflict = "CONFLICT";
    public const string ValidationFailed = "VALIDATION_FAILED";
    public const string Unexpected = "UNEXPECTED_ERROR";
    public const string MaxLength = "MAX_LENGTH";

    // Autenticação
    public const string InvalidCredentials = "INVALID_CREDENTIALS";
    public const string InactiveUser = "INACTIVE_USER";
    public const string InvalidSession = "INVALID_SESSION";

    // Não encontrado
    public const string ProjectNotFound = "PROJECT_NOT_FOUND";
    public const string TaskNotFound = "TASK_NOT_FOUND";
    public const string UserNotFound = "USER_NOT_FOUND";
    public const string CommentNotFound = "COMMENT_NOT_FOUND";
    public const string NotificationNotFound = "NOTIFICATION_NOT_FOUND";
    public const string MemberNotFound = "MEMBER_NOT_FOUND";

    // Permissões
    public const string ManageUsersForbidden = "MANAGE_USERS_FORBIDDEN";
    public const string CreateProjectForbidden = "CREATE_PROJECT_FORBIDDEN";
    public const string ManageProjectForbidden = "MANAGE_PROJECT_FORBIDDEN";
    public const string ChangeOwnerForbidden = "CHANGE_OWNER_FORBIDDEN";
    public const string EditTaskForbidden = "EDIT_TASK_FORBIDDEN";
    public const string DeleteTaskForbidden = "DELETE_TASK_FORBIDDEN";
    public const string ChangeStatusForbidden = "CHANGE_STATUS_FORBIDDEN";
    public const string MoveTaskForbidden = "MOVE_TASK_FORBIDDEN";
    public const string OwnCommentOnly = "OWN_COMMENT_ONLY";

    // Conflitos
    public const string EmailInUse = "EMAIL_IN_USE";
    public const string SelfDeactivate = "SELF_DEACTIVATE";
    public const string SelfRoleOrStatusChange = "SELF_ROLE_OR_STATUS_CHANGE";
    public const string ProjectHasTasks = "PROJECT_HAS_TASKS";
    public const string InactiveMember = "INACTIVE_MEMBER";
    public const string OwnerAlreadyParticipates = "OWNER_ALREADY_PARTICIPATES";
    public const string AlreadyMember = "ALREADY_MEMBER";
    public const string MemberHasOpenTasks = "MEMBER_HAS_OPEN_TASKS";

    // Validação de campos
    public const string NameRequired = "NAME_REQUIRED";
    public const string EmailRequired = "EMAIL_REQUIRED";
    public const string EmailInvalid = "EMAIL_INVALID";
    public const string PasswordRequired = "PASSWORD_REQUIRED";
    public const string PasswordMinLength = "PASSWORD_MIN_LENGTH";
    public const string PasswordLetters = "PASSWORD_LETTERS";
    public const string PasswordNumbers = "PASSWORD_NUMBERS";
    public const string PasswordSameAsCurrent = "PASSWORD_SAME_AS_CURRENT";
    public const string CurrentPasswordRequired = "CURRENT_PASSWORD_REQUIRED";
    public const string CurrentPasswordIncorrect = "CURRENT_PASSWORD_INCORRECT";
    public const string RoleInvalid = "ROLE_INVALID";
    public const string StatusInvalid = "STATUS_INVALID";
    public const string PriorityInvalid = "PRIORITY_INVALID";
    public const string PositionInvalid = "POSITION_INVALID";
    public const string DescriptionMaxLength = "DESCRIPTION_MAX_LENGTH";
    public const string ProjectNameRequired = "PROJECT_NAME_REQUIRED";
    public const string ProjectNameMinLength = "PROJECT_NAME_MIN_LENGTH";
    public const string ProjectNameMaxLength = "PROJECT_NAME_MAX_LENGTH";
    public const string ProjectDatesOrder = "PROJECT_DATES_ORDER";
    public const string OwnerNotFound = "OWNER_NOT_FOUND";
    public const string OwnerInvalidRole = "OWNER_INVALID_ROLE";
    public const string TaskProjectRequired = "TASK_PROJECT_REQUIRED";
    public const string TaskTitleRequired = "TASK_TITLE_REQUIRED";
    public const string TaskTitleMaxLength = "TASK_TITLE_MAX_LENGTH";
    public const string TaskDatesOrder = "TASK_DATES_ORDER";
    public const string AssigneeNotFound = "ASSIGNEE_NOT_FOUND";
    public const string AssigneeNotMember = "ASSIGNEE_NOT_MEMBER";
    public const string ParentSelf = "PARENT_SELF";
    public const string ParentNotFound = "PARENT_NOT_FOUND";
    public const string ParentOtherProject = "PARENT_OTHER_PROJECT";
    public const string ParentCycle = "PARENT_CYCLE";
    public const string CommentRequired = "COMMENT_REQUIRED";
    public const string CommentMaxLength = "COMMENT_MAX_LENGTH";
}
