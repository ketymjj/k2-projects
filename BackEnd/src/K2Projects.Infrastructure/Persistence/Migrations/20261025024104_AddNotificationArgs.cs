using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace K2Projects.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationArgs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "args",
                table: "notifications",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "args",
                table: "notifications");
        }
    }
}
