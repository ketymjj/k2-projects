using K2Projects.Application.Comments;
using K2Projects.Application.Common;
using K2Projects.Application.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace K2Projects.Api.Controllers;

[ApiController]
[Route("api/tasks")]
[Authorize]
public class TasksController(TaskService tasks, CommentService comments) : ControllerBase
{
    [HttpGet]
    public Task<PagedResult<TaskListItemDto>> List([FromQuery] TaskQuery query, CancellationToken ct) => tasks.ListAsync(query, ct);

    [HttpGet("my")]
    public Task<MyTasksDto> My(CancellationToken ct) => tasks.MyTasksAsync(ct);

    [HttpGet("{id:guid}")]
    public Task<TaskDetailDto> Get(Guid id, CancellationToken ct) => tasks.GetAsync(id, ct);

    [HttpPost]
    public async Task<ActionResult<TaskListItemDto>> Create(CreateTaskRequest request, CancellationToken ct)
    {
        var task = await tasks.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = task.Id }, task);
    }

    [HttpPut("{id:guid}")]
    public Task<TaskListItemDto> Update(Guid id, UpdateTaskRequest request, CancellationToken ct) => tasks.UpdateAsync(id, request, ct);

    [HttpPatch("{id:guid}/status")]
    public Task<TaskListItemDto> ChangeStatus(Guid id, ChangeStatusRequest request, CancellationToken ct) =>
        tasks.ChangeStatusAsync(id, request.Status, ct);

    /// <summary>Movimentação no Kanban (status + posição na coluna).</summary>
    [HttpPatch("{id:guid}/move")]
    public Task<TaskListItemDto> Move(Guid id, MoveTaskRequest request, CancellationToken ct) => tasks.MoveAsync(id, request, ct);

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await tasks.DeleteAsync(id, ct);
        return NoContent();
    }

    [HttpGet("{id:guid}/comments")]
    public Task<IReadOnlyList<CommentDto>> Comments(Guid id, CancellationToken ct) => comments.ListAsync(id, ct);

    [HttpPost("{id:guid}/comments")]
    public Task<CommentDto> AddComment(Guid id, CommentRequest request, CancellationToken ct) => comments.AddAsync(id, request, ct);
}

[ApiController]
[Route("api/comments")]
[Authorize]
public class CommentsController(CommentService comments) : ControllerBase
{
    [HttpPut("{id:guid}")]
    public Task<CommentDto> Update(Guid id, CommentRequest request, CancellationToken ct) => comments.UpdateAsync(id, request, ct);

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await comments.DeleteAsync(id, ct);
        return NoContent();
    }
}
