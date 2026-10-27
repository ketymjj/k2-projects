using K2Projects.Application.Common;
using K2Projects.Application.Projects;
using K2Projects.Application.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace K2Projects.Api.Controllers;

[ApiController]
[Route("api/projects")]
[Authorize]
public class ProjectsController(ProjectService projects, TaskService tasks) : ControllerBase
{
    [HttpGet]
    public Task<PagedResult<ProjectListItemDto>> List([FromQuery] ProjectQuery query, CancellationToken ct) => projects.ListAsync(query, ct);

    [HttpGet("lookup")]
    public Task<IReadOnlyList<ProjectLookupDto>> Lookup(CancellationToken ct) => projects.LookupAsync(ct);

    [HttpGet("{id:guid}")]
    public Task<ProjectDetailDto> Get(Guid id, CancellationToken ct) => projects.GetAsync(id, ct);

    [HttpPost]
    [Authorize(Roles = "Administrador,Gerente")]
    public async Task<ActionResult<ProjectListItemDto>> Create(ProjectRequest request, CancellationToken ct)
    {
        var project = await projects.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = project.Id }, project);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Administrador,Gerente")]
    public Task<ProjectListItemDto> Update(Guid id, ProjectRequest request, CancellationToken ct) => projects.UpdateAsync(id, request, ct);

    /// <summary>Exclui o projeto. Se houver tarefas, é obrigatório informar confirm=true.</summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Administrador,Gerente")]
    public async Task<IActionResult> Delete(Guid id, [FromQuery] bool confirm, CancellationToken ct)
    {
        await projects.DeleteAsync(id, confirm, ct);
        return NoContent();
    }

    [HttpGet("{id:guid}/board")]
    public Task<IReadOnlyList<TaskListItemDto>> Board(Guid id, CancellationToken ct) => tasks.BoardAsync(id, ct);

    [HttpGet("{id:guid}/members")]
    public Task<IReadOnlyList<ProjectMemberDto>> Members(Guid id, CancellationToken ct) => projects.GetMembersAsync(id, ct);

    [HttpPost("{id:guid}/members")]
    [Authorize(Roles = "Administrador,Gerente")]
    public Task<IReadOnlyList<ProjectMemberDto>> AddMember(Guid id, AddMemberRequest request, CancellationToken ct) =>
        projects.AddMemberAsync(id, request.UserId, ct);

    [HttpDelete("{id:guid}/members/{userId:guid}")]
    [Authorize(Roles = "Administrador,Gerente")]
    public async Task<IActionResult> RemoveMember(Guid id, Guid userId, CancellationToken ct)
    {
        await projects.RemoveMemberAsync(id, userId, ct);
        return NoContent();
    }
}
