using K2Projects.Application.Common;
using K2Projects.Domain.Entities;
using K2Projects.Domain.Enums;

namespace K2Projects.Application.Users;

public record UserDto(Guid Id, string Name, string Email, UserRole Role, bool Active, DateTime CreatedAt)
{
    public static UserDto From(User u) => new(u.Id, u.Name, u.Email, u.Role, u.Active, u.CreatedAt);
}

public record UserLookupDto(Guid Id, string Name, string Email, UserRole Role);

public record CreateUserRequest(string Name, string Email, string Password, UserRole Role);

public record UpdateUserRequest(string Name, string Email, UserRole Role, bool Active, string? NewPassword);

public record SetUserActiveRequest(bool Active);

public class UserQuery : PageQuery
{
    public string? Search { get; set; }
    public UserRole? Role { get; set; }
    public bool? Active { get; set; }
}
