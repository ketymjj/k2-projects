using K2Projects.Application.Common;
using K2Projects.Application.Profile;
using K2Projects.Application.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace K2Projects.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public class UsersController(UserService users) : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = "Administrador")]
    public Task<PagedResult<UserDto>> List([FromQuery] UserQuery query, CancellationToken ct) => users.ListAsync(query, ct);

    [HttpGet("lookup")]
    public Task<IReadOnlyList<UserLookupDto>> Lookup(CancellationToken ct) => users.LookupAsync(ct);

    [HttpGet("{id:guid}")]
    [Authorize(Roles = "Administrador")]
    public Task<UserDto> Get(Guid id, CancellationToken ct) => users.GetAsync(id, ct);

    [HttpPost]
    [Authorize(Roles = "Administrador")]
    public async Task<ActionResult<UserDto>> Create(CreateUserRequest request, CancellationToken ct)
    {
        var user = await users.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = user.Id }, user);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Administrador")]
    public Task<UserDto> Update(Guid id, UpdateUserRequest request, CancellationToken ct) => users.UpdateAsync(id, request, ct);

    [HttpPatch("{id:guid}/active")]
    [Authorize(Roles = "Administrador")]
    public Task<UserDto> SetActive(Guid id, SetUserActiveRequest request, CancellationToken ct) => users.SetActiveAsync(id, request.Active, ct);
}

[ApiController]
[Route("api/profile")]
[Authorize]
public class ProfileController(ProfileService profile) : ControllerBase
{
    [HttpGet]
    public Task<UserDto> Get(CancellationToken ct) => profile.GetAsync(ct);

    [HttpPut]
    public Task<UserDto> Update(UpdateProfileRequest request, CancellationToken ct) => profile.UpdateAsync(request, ct);

    [HttpPost("password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request, CancellationToken ct)
    {
        await profile.ChangePasswordAsync(request, ct);
        return NoContent();
    }
}
