using FluentValidation;
using K2Projects.Application.Common;
using K2Projects.Domain.Enums;

namespace K2Projects.Application.Projects;

public record ProjectListItemDto(
    Guid Id,
    string Name,
    string? Description,
    DateOnly? StartDate,
    DateOnly? DueDate,
    ProjectStatus Status,
    Guid OwnerId,
    string OwnerName,
    int TaskCount,
    int CompletedTaskCount,
    int OverdueTaskCount,
    int Progress,
    int MemberCount,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    bool CanManage);

public record ProjectMemberDto(Guid UserId, string Name, string Email, UserRole Role, DateTime AddedAt, int OpenTaskCount);

public record ProjectDetailDto(
    ProjectListItemDto Project,
    int TodoCount,
    int InProgressCount,
    IReadOnlyList<ProjectMemberDto> Members);

public record ProjectLookupDto(Guid Id, string Name, ProjectStatus Status, bool CanManage);

public record ProjectRequest(
    string Name,
    string? Description,
    DateOnly? StartDate,
    DateOnly? DueDate,
    ProjectStatus Status,
    Guid? OwnerId,
    IReadOnlyList<Guid>? MemberIds);

public record AddMemberRequest(Guid UserId);

public class ProjectQuery : PageQuery
{
    public string? Search { get; set; }
    public ProjectStatus? Status { get; set; }
}

public class ProjectRequestValidator : AbstractValidator<ProjectRequest>
{
    public ProjectRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Informe o nome do projeto.").WithErrorCode(ErrorCodes.ProjectNameRequired)
            .MinimumLength(3).WithMessage("O nome deve ter pelo menos 3 caracteres.").WithErrorCode(ErrorCodes.ProjectNameMinLength)
            .MaximumLength(150).WithMessage("O nome deve ter no máximo 150 caracteres.").WithErrorCode(ErrorCodes.ProjectNameMaxLength);
        RuleFor(x => x.Description).MaximumLength(2000).WithMessage("A descrição deve ter no máximo 2000 caracteres.").WithErrorCode(ErrorCodes.DescriptionMaxLength);
        RuleFor(x => x.Status).IsInEnum().WithMessage("Status inválido.").WithErrorCode(ErrorCodes.StatusInvalid);
        RuleFor(x => x.DueDate)
            .GreaterThanOrEqualTo(x => x.StartDate)
            .When(x => x.StartDate.HasValue && x.DueDate.HasValue)
            .WithMessage("A data de entrega deve ser igual ou posterior à data de início.").WithErrorCode(ErrorCodes.ProjectDatesOrder);
    }
}
