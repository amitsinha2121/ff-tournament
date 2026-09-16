require("dotenv").config();

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const adminTokens = new Set();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});


// ===============================
// ADMIN LOGIN
// ===============================

app.post("/admin/login", (req, res) => {

    const { username, password } = req.body;

    if (
        username === ADMIN_USERNAME &&
        password === ADMIN_PASSWORD
    ) {

        const token = crypto.randomBytes(32).toString("hex");

        adminTokens.add(token);

        return res.json({
            success: true,
            token
        });
    }

    res.status(401).json({
        success: false,
        message: "Invalid username or password"
    });
});


// ===============================
// ADMIN SECURITY CHECK
// ===============================

function requireAdmin(req, res, next) {

    const token =
        req.headers.authorization?.replace("Bearer ", "");

    if (!token || !adminTokens.has(token)) {

        return res.status(401).json({
            success: false,
            message: "Unauthorized"
        });
    }

    next();
}


// ===============================
// TEAM REGISTRATION
// ===============================

app.post("/register", async (req, res) => {

    try {

        const {
            team_name,
            captain_name,
            captain_uid,
            player2_name,
            player2_uid,
            player3_name,
            player3_uid,
            player4_name,
            player4_uid,
            phone,
            transaction_id
        } = req.body;

        const { data, error } = await supabase
            .from("tournament_registrations")
            .insert([
                {
                    team_name,
                    captain_name,
                    captain_uid,
                    player2_name,
                    player2_uid,
                    player3_name,
                    player3_uid,
                    player4_name,
                    player4_uid,
                    phone,
                    transaction_id
                }
            ])
            .select();

        if (error) {

            console.error("Supabase Error:", error);

            return res.status(500).json({
                success: false,
                message: "Registration save হয়নি"
            });
        }

        res.json({
            success: true,
            message: "Registration সফল হয়েছে! 🏆",
            data
        });

    } catch (error) {

        console.error("Server Error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

// ===============================
// PLAYER DASHBOARD
// ===============================

app.get("/player/:uid", async (req, res) => {

    try {

        const { uid } = req.params;

        const { data, error } = await supabase
            .from("tournament_registrations")
            .select("team_name, captain_name, captain_uid, status, admin_note")
            .eq("captain_uid", uid)
            .order("created_at", {
                ascending: false
            })
            .limit(1);

        if (error) {

            console.error("Player Supabase Error:", error);

            return res.status(500).json({
                success: false,
                message: "Team data load হয়নি"
            });
        }

        if (!data || data.length === 0) {

            return res.status(404).json({
                success: false,
                message: "এই UID দিয়ে কোনো team পাওয়া যায়নি"
            });
        }

        res.json({
            success: true,
            data: data[0]
        });

    } catch (error) {

        console.error("Player Error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});
// ===============================
// ADMIN REGISTRATIONS
// ===============================
// ===============================
// DELETE ALL REGISTRATIONS
// ===============================

app.delete(
    "/admin/registrations/all",
    requireAdmin,
    async (req, res) => {

        try {

            const { data, error } = await supabase
                .from("tournament_registrations")
                .select("id");

            if (error) {
                console.error("Fetch registrations error:", error);

                return res.status(500).json({
                    success: false,
                    message: "Registration fetch failed"
                });
            }

            if (!data || data.length === 0) {
                return res.json({
                    success: true,
                    message: "কোনো registration নেই"
                });
            }

            const ids = data.map(row => row.id);

            const { error: deleteError } = await supabase
                .from("tournament_registrations")
                .delete()
                .in("id", ids);

            if (deleteError) {
                console.error("Delete registrations error:", deleteError);

                return res.status(500).json({
                    success: false,
                    message: "Registration delete failed"
                });
            }

            res.json({
                success: true,
                message: `${ids.length}টি registration delete হয়েছে`
            });

        } catch (error) {

            console.error("Delete all error:", error);

            res.status(500).json({
                success: false,
                message: "Server error"
            });
        }
    }
);
app.get(
    "/admin/registrations",
    requireAdmin,
    async (req, res) => {

        try {

            const { data, error } = await supabase
                .from("tournament_registrations")
                .select("*")
                .order("created_at", {
                    ascending: false
                });

            if (error) {

                console.error(
                    "Admin Supabase Error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message: "Data load হয়নি"
                });
            }

            res.json({
                success: true,
                data
            });

        } catch (error) {

            console.error(
                "Admin Error:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Server error"
            });
        }
    }
);

// ===============================
// UPDATE TEAM STATUS
// ===============================

app.patch(
    "/admin/registrations/:id/status",
    requireAdmin,
    async (req, res) => {

        try {

            const { id } = req.params;
            const { status, admin_note } = req.body;

            if (!["Pending", "Approved", "Rejected"].includes(status)) {

                return res.status(400).json({
                    success: false,
                    message: "Invalid status"
                });
            }

            const { data, error } = await supabase
                .from("tournament_registrations")
                .update({
                    status,
                    admin_note: admin_note || null
                })
                .eq("id", id)
                .select();

            if (error) {

                console.error(
                    "Status Update Error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message: "Status update হয়নি"
                });
            }

            res.json({
                success: true,
                message: "Status updated successfully",
                data
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Server error"
            });
        }
    }
);
// ===============================
// TOURNAMENT SETTINGS
// ===============================
// ===============================
// PUBLIC TOURNAMENT SETTINGS
// ===============================
app.get("/tournament-settings/:uid", async (req, res) => {
    try {
        const { uid } = req.params;

        // Check player approval
        const { data: player, error: playerError } = await supabase
            .from("tournament_registrations")
            .select("team_name, status")
            .eq("captain_uid", uid)
            .order("created_at", { ascending: false })
            .limit(1);

        if (playerError) {
            console.error("Player Check Error:", playerError);

            return res.status(500).json({
                success: false,
                message: "Player check হয়নি"
            });
        }

        if (!player || player.length === 0) {
            return res.status(404).json({
                success: false,
                message: "এই UID দিয়ে কোনো registration পাওয়া যায়নি"
            });
        }

        // Only Approved players can get room information
        if (player[0].status !== "Approved") {
            return res.status(403).json({
                success: false,
                message: "Admin approval ছাড়া Room ID এবং Password দেখা যাবে না"
            });
        }

        // Get latest tournament settings
        const { data: settings, error: settingsError } = await supabase
            .from("tournament_settings")
            .select("room_id, room_password, tournament_status")
            .order("id", { ascending: false })
            .limit(1);

        if (settingsError) {
            console.error("Settings Error:", settingsError);

            return res.status(500).json({
                success: false,
                message: "Tournament settings load হয়নি"
            });
        }

        res.json({
            success: true,
            data: settings[0] || null
        });

    } catch (error) {
        console.error("Room Security Error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});
app.get(
    "/admin/tournament-settings",
    requireAdmin,
    async (req, res) => {

        try {

            const { data, error } = await supabase
                .from("tournament_settings")
                .select("*")
                .order("id", { ascending: false })
                .limit(1);

            if (error) {
                console.error(error);

                return res.status(500).json({
                    success: false,
                    message: "Settings load হয়নি"
                });
            }

            res.json({
                success: true,
                data: data[0] || null
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Server error"
            });
        }
    }
);


app.post(
    "/admin/tournament-settings",
    requireAdmin,
    async (req, res) => {

        try {

            const {
                room_id,
                room_password,
                tournament_status
            } = req.body;

            const { data, error } = await supabase
                .from("tournament_settings")
                .insert([
                    {
                        room_id,
                        room_password,
                        tournament_status,
                        updated_at: new Date().toISOString()
                    }
                ])
                .select();

            if (error) {

                console.error(error);

                return res.status(500).json({
                    success: false,
                    message: "Settings save হয়নি"
                });
            }

            res.json({
                success: true,
                message: "Tournament settings saved!",
                data
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Server error"
            });
        }
    }
);
// ===============================
// START SERVER
// ===============================
// ===============================
// NOTICE BOARD
// ===============================

// Get all notices - Public
app.get("/notices", async (req, res) => {

    try {

        const { data, error } = await supabase
            .from("tournament_notices")
            .select("*")
            .order("created_at", {
                ascending: false
            });

        if (error) {

            console.error(
                "Notice Load Error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Notice load হয়নি"
            });
        }

        res.json({
            success: true,
            data
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});


// Add notice - Admin only
app.post(
    "/admin/notices",
    requireAdmin,
    async (req, res) => {

        try {

            const {
                title,
                message,
                tournament_date,
                tournament_time
            } = req.body;

            if (!title || !message) {

                return res.status(400).json({
                    success: false,
                    message: "Title এবং Message দিতে হবে"
                });
            }

            const { data, error } = await supabase
                .from("tournament_notices")
                .insert([
                    {
                        title,
                        message,
                        tournament_date,
                        tournament_time
                    }
                ])
                .select();

            if (error) {

                console.error(
                    "Notice Save Error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message: "Notice save হয়নি"
                });
            }

            res.json({
                success: true,
                message: "Notice added successfully!",
                data
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Server error"
            });
        }
    }
);


// Delete notice - Admin only
app.delete(
    "/admin/notices/:id",
    requireAdmin,
    async (req, res) => {

        try {

            const { id } = req.params;

            const { error } = await supabase
                .from("tournament_notices")
                .delete()
                .eq("id", id);

            if (error) {

                console.error(
                    "Notice Delete Error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message: "Notice delete হয়নি"
                });
            }

            res.json({
                success: true,
                message: "Notice deleted successfully!"
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Server error"
            });
        }
    }
);
// ================= LEADERBOARD API =================

app.get("/admin/leaderboard", requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("tournament_leaderboard")
            .select("*")
            .order("points", { ascending: false })
            .order("kills", { ascending: false });

        if (error) {
            console.error("Leaderboard Load Error:", error);
            return res.status(500).json({
                success: false,
                message: "Leaderboard load হয়নি"
            });
        }

        res.json({
            success: true,
            data
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});


app.post("/admin/leaderboard", requireAdmin, async (req, res) => {
    try {
        const { team_name, kills, points } = req.body;

        if (!team_name) {
            return res.status(400).json({
                success: false,
                message: "Team Name দিতে হবে"
            });
        }

        const { data: existing } = await supabase
            .from("tournament_leaderboard")
            .select("id")
            .eq("team_name", team_name)
            .limit(1);

        let data;
        let error;

        if (existing && existing.length > 0) {

            const result = await supabase
                .from("tournament_leaderboard")
                .update({
                    kills: Number(kills) || 0,
                    points: Number(points) || 0
                })
                .eq("id", existing[0].id)
                .select();

            data = result.data;
            error = result.error;

        } else {

            const result = await supabase
                .from("tournament_leaderboard")
                .insert([{
                    team_name,
                    kills: Number(kills) || 0,
                    points: Number(points) || 0
                }])
                .select();

            data = result.data;
            error = result.error;
        }

        if (error) {
            console.error("Leaderboard Save Error:", error);

            return res.status(500).json({
                success: false,
                message: "Leaderboard save হয়নি"
            });
        }

        res.json({
            success: true,
            message: "Leaderboard updated successfully! 🏆",
            data
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});


app.delete("/admin/leaderboard/:id", requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from("tournament_leaderboard")
            .delete()
            .eq("id", id);

        if (error) {
            console.error("Leaderboard Delete Error:", error);

            return res.status(500).json({
                success: false,
                message: "Leaderboard delete হয়নি"
            });
        }

        res.json({
            success: true,
            message: "Leaderboard deleted successfully!"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});


// Public Leaderboard

app.get("/leaderboard", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("tournament_leaderboard")
            .select("team_name, kills, points")
            .order("points", { ascending: false })
            .order("kills", { ascending: false });

        if (error) {
            console.error("Public Leaderboard Error:", error);

            return res.status(500).json({
                success: false,
                message: "Leaderboard load হয়নি"
            });
        }

        res.json({
            success: true,
            data
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});
app.listen(PORT, () => {

    console.log(
        `🔥 FF Tournament App চলছে: http://localhost:${PORT}`
    );

});
