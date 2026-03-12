use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Colour palette per companion theme
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompanionColors {
    pub hair: String,
    pub skin: String,
    pub shirt: String,
    pub pants: String,
    pub shoes: String,
}

impl CompanionColors {
    /// Resolve a `CompanionColors` from a companion_type slug.
    pub fn from_type(companion_type: &str) -> Self {
        use crate::companion_store::COMPANION_TYPES;
        if let Some(theme) = COMPANION_TYPES.get(companion_type) {
            CompanionColors {
                hair: theme.hair.to_string(),
                skin: theme.skin.to_string(),
                shirt: theme.shirt.to_string(),
                pants: theme.pants.to_string(),
                shoes: theme.shoes.to_string(),
            }
        } else {
            // default / blue theme
            CompanionColors {
                hair: "#3b2314".to_string(),
                skin: "#f5c5a3".to_string(),
                shirt: "#4a90d9".to_string(),
                pants: "#2c3e6b".to_string(),
                shoes: "#1a1a2e".to_string(),
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Animation frame
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnimationFrame {
    /// Complete SVG document for this frame (80×160 viewBox).
    pub svg: String,
    /// How long to display this frame (milliseconds).
    pub duration_ms: u32,
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Return every frame for the requested animation state.
pub fn get_frames(state: &str, colors: &CompanionColors) -> Vec<AnimationFrame> {
    let frame_count = frame_count_for_state(state);
    (0..frame_count)
        .map(|i| {
            let duration_ms = frame_duration_ms(state, i);
            AnimationFrame {
                svg: render_frame_svg(state, i, colors),
                duration_ms,
            }
        })
        .collect()
}

/// Render a single SVG frame for (`state`, `frame_index`).
pub fn render_frame_svg(state: &str, frame_index: usize, colors: &CompanionColors) -> String {
    let (left_arm, right_arm, body_dy, eye_shape, mouth_shape) =
        pose_for_frame(state, frame_index);

    build_svg(colors, left_arm, right_arm, body_dy, eye_shape, mouth_shape)
}

// ---------------------------------------------------------------------------
// Per-state metadata
// ---------------------------------------------------------------------------

fn frame_count_for_state(state: &str) -> usize {
    match state {
        "idle" => 4,
        "idle_wave" => 6,
        "idle_stretch" => 4,
        "idle_look" => 4,
        "idle_excited" => 6,
        "active" => 2,
        "typing" => 4,
        "coding" => 4,
        "sleeping" => 3,
        "walking" => 6,
        "greeting" => 4,
        _ => 2,
    }
}

fn frame_duration_ms(state: &str, _frame_index: usize) -> u32 {
    match state {
        "idle" => 600,
        "idle_wave" => 120,
        "idle_stretch" => 300,
        "idle_look" => 400,
        "idle_excited" => 80,
        "active" => 250,
        "typing" => 100,
        "coding" => 180,
        "sleeping" => 1200,
        "walking" => 150,
        "greeting" => 200,
        _ => 300,
    }
}

// ---------------------------------------------------------------------------
// Pose tables
// ---------------------------------------------------------------------------

/// Returns (left_arm_transform, right_arm_transform, body_dy, eye_variant, mouth_variant)
///
/// All transforms are SVG `transform` attribute strings applied to the arm `<g>` elements.
/// `body_dy` is a pixel offset for the whole body (breathing / bounce).
fn pose_for_frame(
    state: &str,
    frame_index: usize,
) -> (&'static str, &'static str, f32, &'static str, &'static str) {
    let fi = frame_index % frame_count_for_state(state);
    match state {
        "idle" => {
            let dy = if fi % 2 == 0 { 0.0 } else { -2.0 };
            ("rotate(10,10,4)", "rotate(-10,4,4)", dy, "open", "smile")
        }
        "idle_wave" => {
            // Pre-computed static angle strings for each frame
            const WAVE_LEFT: [&str; 6] = [
                "rotate(-30,10,4)",
                "rotate(-50,10,4)",
                "rotate(-70,10,4)",
                "rotate(-50,10,4)",
                "rotate(-30,10,4)",
                "rotate(0,10,4)",
            ];
            (
                WAVE_LEFT[fi % WAVE_LEFT.len()],
                "rotate(-5,4,4)",
                0.0,
                "open",
                "smile",
            )
        }
        "idle_stretch" => {
            const ARMS: [(&str, &str); 4] = [
                ("rotate(-60,10,4)", "rotate(60,4,4)"),
                ("rotate(-80,10,4)", "rotate(80,4,4)"),
                ("rotate(-60,10,4)", "rotate(60,4,4)"),
                ("rotate(10,10,4)", "rotate(-10,4,4)"),
            ];
            let dy = if fi == 1 { -4.0 } else { 0.0 };
            (ARMS[fi].0, ARMS[fi].1, dy, "squint", "open")
        }
        "idle_look" => {
            const ARMS: [(&str, &str); 4] = [
                ("rotate(10,10,4)", "rotate(-10,4,4)"),
                ("rotate(15,10,4)", "rotate(-15,4,4)"),
                ("rotate(10,10,4)", "rotate(-10,4,4)"),
                ("rotate(5,10,4)", "rotate(-5,4,4)"),
            ];
            (ARMS[fi].0, ARMS[fi].1, 0.0, "side", "smile")
        }
        "idle_excited" => {
            let dy = if fi % 2 == 0 { -4.0 } else { 0.0 };
            (
                "rotate(-70,10,4)",
                "rotate(70,4,4)",
                dy,
                "open",
                "grin",
            )
        }
        "active" => (
            "rotate(-20,10,4)",
            "rotate(20,4,4)",
            if fi == 0 { 0.0 } else { -1.0 },
            "open",
            "smile",
        ),
        "typing" => {
            const ARMS: [(&str, &str); 4] = [
                ("rotate(-15,10,4)", "rotate(15,4,4)"),
                ("rotate(-5,10,4)", "rotate(5,4,4)"),
                ("rotate(-20,10,4)", "rotate(10,4,4)"),
                ("rotate(-8,10,4)", "rotate(20,4,4)"),
            ];
            (ARMS[fi].0, ARMS[fi].1, 0.0, "focused", "open")
        }
        "coding" => {
            const ARMS: [(&str, &str); 4] = [
                ("rotate(-30,10,4)", "rotate(25,4,4)"),
                ("rotate(-25,10,4)", "rotate(30,4,4)"),
                ("rotate(-35,10,4)", "rotate(20,4,4)"),
                ("rotate(-20,10,4)", "rotate(35,4,4)"),
            ];
            (ARMS[fi].0, ARMS[fi].1, 0.0, "focused", "open")
        }
        "sleeping" => {
            let dy = if fi == 1 { 2.0 } else { 0.0 };
            ("rotate(40,10,4)", "rotate(-40,4,4)", dy, "closed", "open")
        }
        "walking" => {
            const FRAMES: [(&str, &str, f32); 6] = [
                ("rotate(-30,10,4)", "rotate(30,4,4)", 0.0),
                ("rotate(-15,10,4)", "rotate(15,4,4)", -2.0),
                ("rotate(10,10,4)", "rotate(-10,4,4)", 0.0),
                ("rotate(30,10,4)", "rotate(-30,4,4)", -2.0),
                ("rotate(15,10,4)", "rotate(-15,4,4)", 0.0),
                ("rotate(-10,10,4)", "rotate(10,4,4)", -2.0),
            ];
            let f = &FRAMES[fi % FRAMES.len()];
            (f.0, f.1, f.2, "open", "smile")
        }
        "greeting" => {
            const GREET_LEFT: [&str; 4] = [
                "rotate(-30,10,4)",
                "rotate(-60,10,4)",
                "rotate(-80,10,4)",
                "rotate(-60,10,4)",
            ];
            const DY: [f32; 4] = [0.0, -2.0, -2.0, 0.0];
            (GREET_LEFT[fi], "rotate(-5,4,4)", DY[fi], "open", "grin")
        }
        _ => ("rotate(10,10,4)", "rotate(-10,4,4)", 0.0, "open", "smile"),
    }
}

// ---------------------------------------------------------------------------
// SVG rendering
// ---------------------------------------------------------------------------

/// Build a complete 80×160 SVG document for a character pose.
fn build_svg(
    c: &CompanionColors,
    left_arm_transform: &str,
    right_arm_transform: &str,
    body_dy: f32,
    eye_shape: &str,
    mouth_shape: &str,
) -> String {
    let body_offset = body_dy;

    // Character anchor: centred at x=40, head top at y=20
    let head_x = 22.0_f32;
    let head_y = 20.0_f32 + body_offset;
    let head_w = 36.0_f32;
    let head_h = 32.0_f32;

    // Torso
    let torso_x = 24.0_f32;
    let torso_y = head_y + head_h;
    let torso_w = 32.0_f32;
    let torso_h = 28.0_f32;

    // Pants
    let pants_y = torso_y + torso_h;
    let pants_h = 22.0_f32;

    // Shoes
    let shoes_y = pants_y + pants_h;

    // Arm geometry (pivot points relative to shoulder)
    let l_arm_ox = torso_x;
    let l_arm_oy = torso_y + 6.0;
    let r_arm_ox = torso_x + torso_w;
    let r_arm_oy = l_arm_oy;

    let eyes = render_eyes(
        head_x + head_w / 2.0 - 8.0,
        head_y + 12.0,
        eye_shape,
        &c.hair,
    );
    let mouth = render_mouth(
        head_x + head_w / 2.0,
        head_y + 22.0,
        mouth_shape,
        &c.hair,
    );

    format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" width="80" height="160" viewBox="0 0 80 160">
  <!-- Hair -->
  <rect x="{head_x}" y="{}" width="{head_w}" height="10" rx="8" fill="{}"/>
  <!-- Head -->
  <rect x="{head_x}" y="{head_y}" width="{head_w}" height="{head_h}" rx="8" fill="{}"/>
  <!-- Eyes -->
  {eyes}
  <!-- Mouth -->
  {mouth}
  <!-- Left arm -->
  <g transform="translate({l_arm_ox},{l_arm_oy})">
    <g transform="{left_arm_transform}">
      <rect x="-10" y="0" width="10" height="22" rx="4" fill="{}"/>
      <rect x="-10" y="18" width="10" height="8" rx="3" fill="{}"/>
    </g>
  </g>
  <!-- Right arm -->
  <g transform="translate({r_arm_ox},{r_arm_oy})">
    <g transform="{right_arm_transform}">
      <rect x="0" y="0" width="10" height="22" rx="4" fill="{}"/>
      <rect x="0" y="18" width="10" height="8" rx="3" fill="{}"/>
    </g>
  </g>
  <!-- Torso -->
  <rect x="{torso_x}" y="{torso_y}" width="{torso_w}" height="{torso_h}" rx="4" fill="{}"/>
  <!-- Pants -->
  <rect x="{torso_x}" y="{pants_y}" width="{}" height="{pants_h}" rx="3" fill="{}"/>
  <rect x="{}" y="{pants_y}" width="{}" height="{pants_h}" rx="3" fill="{}"/>
  <!-- Shoes -->
  <ellipse cx="{}" cy="{}" rx="9" ry="5" fill="{}"/>
  <ellipse cx="{}" cy="{}" rx="9" ry="5" fill="{}"/>
</svg>"#,
        // hair top
        head_y - 6.0,
        c.hair,
        // head
        c.skin,
        // left arm shirt colour
        c.shirt,
        // left hand skin
        c.skin,
        // right arm shirt colour
        c.shirt,
        // right hand skin
        c.skin,
        // torso
        c.shirt,
        // left leg width
        torso_w / 2.0 - 1.0,
        c.pants,
        // right leg x
        torso_x + torso_w / 2.0 + 1.0,
        // right leg width
        torso_w / 2.0 - 1.0,
        c.pants,
        // left shoe
        torso_x + (torso_w / 4.0),
        shoes_y + 4.0,
        c.shoes,
        // right shoe
        torso_x + (3.0 * torso_w / 4.0),
        shoes_y + 4.0,
        c.shoes,
    )
}

/// Render both eyes as SVG elements.
fn render_eyes(lx: f32, ly: f32, variant: &str, color: &str) -> String {
    let rx = lx + 16.0;
    match variant {
        "closed" => format!(
            r#"<line x1="{}" y1="{}" x2="{}" y2="{}" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
               <line x1="{}" y1="{}" x2="{}" y2="{}" stroke="{color}" stroke-width="2" stroke-linecap="round"/>"#,
            lx, ly, lx + 6.0, ly,
            rx, ly, rx + 6.0, ly,
        ),
        "squint" => format!(
            r#"<ellipse cx="{}" cy="{}" rx="3" ry="2" fill="{color}"/>
               <ellipse cx="{}" cy="{}" rx="3" ry="2" fill="{color}"/>"#,
            lx + 3.0, ly + 1.0,
            rx + 3.0, ly + 1.0,
        ),
        "side" => format!(
            r#"<ellipse cx="{}" cy="{}" rx="4" ry="4" fill="{color}"/>
               <ellipse cx="{}" cy="{}" rx="4" ry="4" fill="{color}"/>
               <ellipse cx="{}" cy="{}" rx="2" ry="2" fill="white"/>
               <ellipse cx="{}" cy="{}" rx="2" ry="2" fill="white"/>"#,
            lx + 3.0, ly + 2.0,
            rx + 3.0, ly + 2.0,
            lx + 5.0, ly + 2.0,
            rx + 5.0, ly + 2.0,
        ),
        "focused" => format!(
            r#"<ellipse cx="{}" cy="{}" rx="4" ry="3" fill="{color}"/>
               <ellipse cx="{}" cy="{}" rx="4" ry="3" fill="{color}"/>
               <ellipse cx="{}" cy="{}" rx="1.5" ry="1.5" fill="white"/>
               <ellipse cx="{}" cy="{}" rx="1.5" ry="1.5" fill="white"/>"#,
            lx + 3.0, ly + 1.5,
            rx + 3.0, ly + 1.5,
            lx + 3.0, ly + 1.5,
            rx + 3.0, ly + 1.5,
        ),
        _ => {
            // "open" default
            format!(
                r#"<ellipse cx="{}" cy="{}" rx="4" ry="4" fill="{color}"/>
                   <ellipse cx="{}" cy="{}" rx="4" ry="4" fill="{color}"/>
                   <ellipse cx="{}" cy="{}" rx="2" ry="2" fill="white"/>
                   <ellipse cx="{}" cy="{}" rx="2" ry="2" fill="white"/>"#,
                lx + 3.0,
                ly + 2.0,
                rx + 3.0,
                ly + 2.0,
                lx + 4.0,
                ly + 1.5,
                rx + 4.0,
                ly + 1.5,
            )
        }
    }
}

/// Render the mouth as an SVG element.
fn render_mouth(cx: f32, y: f32, variant: &str, color: &str) -> String {
    match variant {
        "open" => format!(
            r#"<path d="M {} {} Q {} {} {} {}" stroke="{color}" stroke-width="1.5" fill="none" stroke-linecap="round"/>"#,
            cx - 5.0, y,
            cx, y + 3.0,
            cx + 5.0, y,
        ),
        "grin" => format!(
            r#"<path d="M {} {} Q {} {} {} {}" stroke="{color}" stroke-width="2" fill="none" stroke-linecap="round"/>
               <path d="M {} {} Q {} {} {} {}" stroke="none" fill="{color}" opacity="0.15"/>"#,
            cx - 7.0, y,
            cx, y + 6.0,
            cx + 7.0, y,
            cx - 7.0, y,
            cx, y + 6.0,
            cx + 7.0, y,
        ),
        "smile" => format!(
            r#"<path d="M {} {} Q {} {} {} {}" stroke="{color}" stroke-width="1.5" fill="none" stroke-linecap="round"/>"#,
            cx - 5.0, y,
            cx, y + 4.0,
            cx + 5.0, y,
        ),
        _ => format!(
            r#"<line x1="{}" y1="{y}" x2="{}" y2="{y}" stroke="{color}" stroke-width="1.5" stroke-linecap="round"/>"#,
            cx - 4.0,
            cx + 4.0,
        ),
    }
}
