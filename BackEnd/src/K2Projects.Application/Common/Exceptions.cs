using FluentValidation;
using FluentValidation.Results;

namespace K2Projects.Application.Common;

/// <summary>
/// Exceção com código estável (ex.: PROJECT_NOT_FOUND) que o frontend traduz.
/// A mensagem em português permanece como texto de reserva e para os logs.
/// </summary>
public abstract class AppException(string message, string code, IReadOnlyDictionary<string, object?>? args) : Exception(message)
{
    public string Code { get; } = code;
    public IReadOnlyDictionary<string, object?>? Args { get; } = args;
}

public class NotFoundException(string message, string code = ErrorCodes.NotFound, IReadOnlyDictionary<string, object?>? args = null)
    : AppException(message, code, args);

public class ForbiddenException(string message = "Você não tem permissão para executar esta ação.", string code = ErrorCodes.Forbidden, IReadOnlyDictionary<string, object?>? args = null)
    : AppException(message, code, args);

public class UnauthorizedException(string message, string code = ErrorCodes.Unauthorized, IReadOnlyDictionary<string, object?>? args = null)
    : AppException(message, code, args);

/// <summary>Conflito com o estado atual (ex.: e-mail duplicado, exclusão que exige confirmação).</summary>
public class ConflictException(string message, string code = ErrorCodes.Conflict, IReadOnlyDictionary<string, object?>? args = null, object? details = null)
    : AppException(message, code, args)
{
    public object? Details { get; } = details;
}

public static class Validation
{
    /// <summary>Cria uma ValidationException para um campo, com código estável.</summary>
    public static ValidationException Fail(string property, string code, string message) =>
        new([new ValidationFailure(property, message) { ErrorCode = code }]);
}
